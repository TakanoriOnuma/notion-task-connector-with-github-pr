import "dotenv/config";
import { parseArgs } from "node:util";
import { Client } from "@notionhq/client";

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
    githubPrUrl: {
      type: "string",
      description: "GitHub PR URL to link to the Notion page",
    },
  },
});

const NOTION_ID = values.notionId;
const CHANGE_STATUS = values.status;
const GITHUB_PR_URL = values.githubPrUrl;
if (!NOTION_ID || !CHANGE_STATUS || !GITHUB_PR_URL) {
  console.error(
    "次のオプションをコマンドライン引数に渡してください: notionId, status, githubPrUrl"
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
    throw new Error("Target page not found");
  }

  await notion.pages.update({
    page_id: targetPage.id,
    properties: {
      ステータス: {
        type: "status",
        status: {
          name: CHANGE_STATUS,
        },
      },
      "GitHub PR": {
        type: "url",
        url: GITHUB_PR_URL,
      },
    },
  });
})();
