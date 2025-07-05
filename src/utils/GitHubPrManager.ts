import { PageObjectResponse, UpdatePageParameters } from "@notionhq/client";

/** GitHubのPR情報 */
export type GitHubPr = {
  title: string;
  url: string;
};

/** Notionプロパティ（リッチテキスト） */
export type RichTextProperty = Extract<
  Required<UpdatePageParameters>["properties"][string],
  { type?: "rich_text" }
>;

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

export class GitHubPrManager {
  /** GitHubのPR情報リスト */
  public githubPrs: GitHubPr[];

  constructor(property: PageObjectResponse["properties"][string]) {
    this.githubPrs = getGitHubPrs(property);
  }

  /**
   * GitHubのPR情報を追加する
   * @param githubPr - GitHubのPR情報
   */
  addGitHubPr(githubPr: GitHubPr) {
    const index = this.githubPrs.findIndex((pr) => pr.url === githubPr.url);
    // 既に同じURLのPRが存在する場合は更新
    if (index !== -1) {
      this.githubPrs[index] = githubPr;
      return;
    }
    // 新しいPRの場合は追加
    this.githubPrs.push(githubPr);
  }

  /**
   * Notionのプロパティに保存するためのGitHub PRのリッチテキストを作成する
   */
  createGitHubPrsRichText() {
    const richTexts: RichTextProperty["rich_text"] = this.githubPrs.map(
      (pr) => ({
        type: "text",
        text: {
          content: pr.title,
          link: {
            url: pr.url,
          },
        },
      })
    );
    return richTexts.flatMap(
      (richText, index): RichTextProperty["rich_text"] => {
        if (index === richTexts.length - 1) {
          return [richText]; // 最後の要素は改行なし
        }
        return [richText, { type: "text", text: { content: "\n" } }];
      }
    );
  }
}
