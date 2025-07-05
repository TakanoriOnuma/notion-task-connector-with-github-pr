import { promises as fsPromises } from "fs";
import { PageObjectResponse } from "@notionhq/client";

import { GitHubPr, GitHubPrManager } from "./utils/GitHubPrManager";
import { parseNotionUniqueIds } from "./utils/parseNotionUniqueIds";
import { NotionManager, NotionProperty } from "./utils/NotionManager";

type Args = {
  /**
   * 変更対象のNotionのユニークIDプロパティ値。複数指定する場合は神間区切りで指定する。
   * @example "TSK-123, TSK-456"
   */
  notionIdProperty: string;
  /** 変更するステータスのNotionプロパティ。変更しない場合は未指定。 */
  statusProperty?: NotionProperty<string>;
  /** 変更するGitHubのPR情報のNotionプロパティ */
  githubPrProperty: NotionProperty<GitHubPr>;
};

/**
 * Notionのプロパティを変更する関数
 */
export const changeNotionProperty = async ({
  notionIdProperty,
  statusProperty,
  githubPrProperty,
}: Args) => {
  const notionManager = new NotionManager();
  const notionUniqueIds = parseNotionUniqueIds(notionIdProperty);

  const results = await Promise.all(
    notionUniqueIds.map(async (notionUniqueId) => {
      const targetPage = await notionManager.fetchNotionPageByUniqueId(
        notionUniqueId
      );

      const githubPrManager = new GitHubPrManager(
        targetPage.properties[githubPrProperty.name]
      );
      githubPrManager.addGitHubPr(githubPrProperty.value);

      return await notionManager.updateNotionProperty(targetPage.id, {
        statusProperty: statusProperty,
        githubPrRichTextProperty: {
          name: githubPrProperty.name,
          value: githubPrManager.createGitHubPrsRichText(),
        },
      });
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
};
