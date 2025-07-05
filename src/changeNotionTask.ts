import "dotenv/config";
import { parseArgs } from "node:util";
import { Client } from "@notionhq/client";

import { GitHubPrManager } from "./utils/GitHubPrManager";

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

  const githubPrManager = new GitHubPrManager(
    targetPage.properties["GitHub PR(text)"]
  );
  githubPrManager.addGitHubPr({
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
        rich_text: githubPrManager.createGitHubPrsRichText(),
      },
      "GitHub PR(url)": {
        type: "url",
        url: GITHUB_PR_URL,
      },
    },
  });
})();
