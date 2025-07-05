import { Client } from "@notionhq/client";
import { NotionUniqueId } from "./parseNotionUniqueIds";
import { GitHubPr, RichTextProperty } from "./GitHubPrManager";

/** Notionプロパティ情報 */
export type NotionProperty<T> = {
  /** プロパティ名 */
  name: string;
  /** プロパティの値 */
  value: T;
};

export class NotionManager {
  private notion: Client;

  constructor() {
    this.notion = new Client({
      auth: process.env.NOTION_TOKEN,
    });
  }

  /**
   * NotionのユニークIDを使ってページを取得する
   * @param notionUniqueId - NotionのユニークID
   */
  async fetchNotionPageByUniqueId(notionUniqueId: NotionUniqueId) {
    const response = await this.notion.databases.query({
      database_id: process.env.DATABASE_ID || "",
      filter: {
        property: "ID",
        type: "unique_id",
        unique_id: {
          equals: notionUniqueId.number,
        },
      },
    });
    const targetPage = response.results[0];
    if (targetPage == null) {
      throw new Error(
        "該当するページが見つかりませんでした: " +
          JSON.stringify(notionUniqueId)
      );
    }
    if (!("properties" in targetPage) || !("parent" in targetPage)) {
      throw new Error(
        "取得したページにプロパティがありません: " + targetPage.id
      );
    }
    if ("title" in targetPage) {
      throw new Error(
        "取得したページにタイトルが含まれています(これはデータベースオブジェクトです): " +
          targetPage.id
      );
    }
    return targetPage;
  }

  /**
   * Notionページのプロパティを更新する
   * @param notionPageId - NotionのページID
   * @param propertySet - 更新するプロパティ群
   */
  async updateNotionProperty(
    notionPageId: string,
    propertySet: {
      /** 変更するステータスのNotionプロパティ。変更しない場合は未指定。 */
      statusProperty?: NotionProperty<string>;
      /** 変更するGitHubのPR情報のリッチテキストNotionプロパティ */
      githubPrRichTextProperty: NotionProperty<RichTextProperty["rich_text"]>;
    }
  ) {
    const { statusProperty, githubPrRichTextProperty } = propertySet;

    const result = await this.notion.pages.update({
      page_id: notionPageId,
      properties: {
        ...(statusProperty != null
          ? {
              ステータス: {
                type: "status",
                status: {
                  name: statusProperty.value,
                },
              },
            }
          : {}),
        [githubPrRichTextProperty.name]: {
          type: "rich_text",
          rich_text: githubPrRichTextProperty.value,
        },
      },
    });
    return result;
  }
}
