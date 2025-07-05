import "dotenv/config";
import { parseArgs } from "node:util";

import { changeNotionProperty } from "../src/changeNotionProperty";

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

(async () => {
  await changeNotionProperty({
    notionId: NOTION_ID,
    statusProperty: CHANGE_STATUS
      ? {
          name: "ステータス",
          value: CHANGE_STATUS,
        }
      : undefined,
    githubPrProperty: {
      name: "GitHub PR(text)",
      value: {
        title: GITHUB_PR_TITLE,
        url: GITHUB_PR_URL,
      },
    },
  });
})();
