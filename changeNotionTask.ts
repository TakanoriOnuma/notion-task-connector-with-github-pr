import "dotenv/config";
import { parseArgs } from "node:util";
import {
  Client,
  PageObjectResponse,
  UpdatePageParameters,
} from "@notionhq/client";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    notionId: {
      type: "string",
      description: "Notion ID to update",
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
if (!NOTION_ID || !CHANGE_STATUS || !GITHUB_PR_TITLE || !GITHUB_PR_URL) {
  console.error(
    "次のオプションをコマンドライン引数に渡してください: notionId, status, githubPrTitle, githubPrUrl"
  );
  process.exit(1);
}

const [prefix, numberStr] = NOTION_ID.split("-");
if (prefix == null || numberStr == null) {
  console.error(
    "Notion IDの形式が正しくありません。例: 'PR-123' のように入力してください。"
  );
  process.exit(1);
}
if (/^\d+/.test(numberStr) === false) {
  console.error(
    "Notion IDの番号部分は数字でなければなりません。例: 'PR-123' のように入力してください。"
  );
  process.exit(1);
}
const NOTION_ID_PREFIX = prefix;
const NOTION_ID_NUMBER = parseInt(numberStr, 10);

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

/** GitHubのPR情報 */
type GitHubPr = {
  title: string;
  url: string;
};

/**
 * GitHub PRのリンクテキストを取得する関数
 * @param property - Notionのページオブジェクトのプロパティ
 */
const getGitHubPrs = (property: PageObjectResponse["properties"][string]) => {
  if (property.type !== "rich_text") {
    throw new Error("'rich_text'タイプのプロパティではありません");
  }
  const githubRegExp = new RegExp("^https://github.com");
  const githubPrs: GitHubPr[] = [];
  property.rich_text.forEach((text) => {
    if (text.type !== "text") {
      return;
    }
    if (text.text.link == null) {
      return;
    }
    if (!githubRegExp.test(text.text.link.url)) {
      return;
    }
    githubPrs.push({
      title: text.text.content.trim(),
      url: text.text.link.url,
    });
  });
  return githubPrs;
};

/**
 * Notionのプロパティに保存するためのGitHub PRのリッチテキストを作成する
 * @param githubPrs - GitHub PRの情報を含む配列
 */
const createGitHubPrsRichText = (githubPrs: GitHubPr[]) => {
  type RichTextProperty = Extract<
    Required<UpdatePageParameters>["properties"][string],
    { type?: "rich_text" }
  >;
  const richTexts: RichTextProperty["rich_text"] = githubPrs.map((pr) => ({
    type: "text",
    text: {
      content: pr.title,
      link: {
        url: pr.url,
      },
    },
  }));
  return richTexts.flatMap((richText, index): RichTextProperty["rich_text"] => {
    if (index === richTexts.length - 1) {
      return [richText]; // 最後の要素は改行なし
    }
    return [richText, { type: "text", text: { content: "\n" } }];
  });
};

(async () => {
  const response = await notion.databases.query({
    database_id: process.env.DATABASE_ID || "",
    filter: {
      property: "ID",
      type: "unique_id",
      unique_id: {
        equals: NOTION_ID_NUMBER,
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

  const githubPrs = getGitHubPrs(targetPage.properties["GitHub PR(text)"]);
  githubPrs.push({
    title: GITHUB_PR_TITLE,
    url: GITHUB_PR_URL,
  });

  await notion.pages.update({
    page_id: targetPage.id,
    properties: {
      ステータス: {
        type: "status",
        status: {
          name: CHANGE_STATUS,
        },
      },
      "GitHub PR(text)": {
        type: "rich_text",
        rich_text: createGitHubPrsRichText(githubPrs),
      },
      "GitHub PR(url)": {
        type: "url",
        url: GITHUB_PR_URL,
      },
    },
  });
})();
