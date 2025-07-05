import "dotenv/config";
import { parseArgs } from "node:util";
import { promises as fsPromises } from "fs";
import { Client, PageObjectResponse } from "@notionhq/client";

import { GitHubPrManager } from "../src/utils/GitHubPrManager";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    notionId: {
      type: "string",
      description:
        "対象のNotion ID。複数指定する場合はカンマ区切りで指定。例: 'TSK-123,TSK-456'",
    },
    status: {
      type: "string",
      description: "Status to set for the Notion page",
    },
    githubPrTitle: {
      type: "string",
      description: "GitHub PR title to link to the Notion page",
    },
    githubPrUrl: {
      type: "string",
      description: "GitHub PR URL to link to the Notion page",
    },
  },
});

const NOTION_ID = values.notionId;
const CHANGE_STATUS = values.status;
const GITHUB_PR_TITLE = values.githubPrTitle;
const GITHUB_PR_URL = values.githubPrUrl;
if (!NOTION_ID || !GITHUB_PR_TITLE || !GITHUB_PR_URL) {
  console.error(
    "次のオプションをコマンドライン引数に渡してください: notionId, githubPrTitle, githubPrUrl"
  );
  process.exit(1);
}

/** NotionのユニークIDプロパティ情報 */
type NotionUniqueId = {
  prefix: string;
  number: number;
};
const NOTION_UNIQUE_IDS: NotionUniqueId[] = NOTION_ID.split(",")
  .map((idStr) => idStr.trim())
  .map((idStr): NotionUniqueId => {
    const [prefix, numberStr] = idStr.split("-");
    if (prefix == null || numberStr == null) {
      throw new Error(
        "Notion IDの形式が正しくありません。例: 'TSK-123' のように入力してください。" +
          idStr
      );
    }
    if (/^\d+/.test(numberStr) === false) {
      throw new Error(
        "Notion IDの番号部分は数字でなければなりません。例: 'TSK-123' のように入力してください。" +
          idStr
      );
    }
    return {
      prefix,
      number: parseInt(numberStr, 10),
    };
  });

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

/**
 * NotionのユニークIDを使ってページを取得する
 * @param notionId - NotionのユニークID
 */
const fetchNotionPageByUniqueId = async (notionId: NotionUniqueId) => {
  const response = await notion.databases.query({
    database_id: process.env.DATABASE_ID || "",
    filter: {
      property: "ID",
      type: "unique_id",
      unique_id: {
        equals: notionId.number,
      },
    },
  });
  const targetPage = response.results[0];
  if (targetPage == null) {
    throw new Error("該当するページが見つかりませんでした" + NOTION_ID);
  }
  if (!("properties" in targetPage) || !("parent" in targetPage)) {
    throw new Error("取得したページにプロパティがありません: " + targetPage.id);
  }
  if ("title" in targetPage) {
    throw new Error(
      "取得したページにタイトルが含まれています(これはデータベースオブジェクトです): " +
        targetPage.id
    );
  }
  return targetPage;
};

(async () => {
  const results = await Promise.all(
    NOTION_UNIQUE_IDS.map(async (notionId) => {
      const targetPage = await fetchNotionPageByUniqueId(notionId);

      const githubPrManager = new GitHubPrManager(
        targetPage.properties["GitHub PR(text)"]
      );
      githubPrManager.addGitHubPr({
        title: GITHUB_PR_TITLE,
        url: GITHUB_PR_URL,
      });

      const result = await notion.pages.update({
        page_id: targetPage.id,
        properties: {
          ...(CHANGE_STATUS != null
            ? {
                ステータス: {
                  type: "status",
                  status: {
                    name: CHANGE_STATUS,
                  },
                },
              }
            : {}),
          "GitHub PR(text)": {
            type: "rich_text",
            rich_text: githubPrManager.createGitHubPrsRichText(),
          },
          "GitHub PR(url)": {
            type: "url",
            url: GITHUB_PR_URL,
          },
        },
      });
      return result;
    })
  );

  const getPageTitle = (result: PageObjectResponse) => {
    const titleProperty = Object.values(result.properties).find(
      (prop) => prop.type === "title"
    );
    if (titleProperty == null) {
      throw new Error(
        "ページのタイトルプロパティが見つかりませんでした: " + result.id
      );
    }
    const title = titleProperty.title.map((text) => text.plain_text).join("");
    return title;
  };

  const text = [
    "Notionの関連タスク一覧です",
    ...results.map((result) => {
      if (!("properties" in result)) {
        throw new Error("ページのプロパティが見つかりません: " + result.id);
      }
      return `- [${getPageTitle(result)}](${result.url})`;
    }),
  ].join("\n");
  await fsPromises.writeFile("./connected-tasks.md", text, "utf8");
})();
