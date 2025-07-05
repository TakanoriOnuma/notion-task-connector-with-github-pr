/** NotionのユニークIDプロパティ情報 */
export type NotionUniqueId = {
  /** プレフィックス */
  prefix: string;
  /** ID */
  number: number;
};

/**
 * NotionのユニークID文字列を解析して、NotionUniqueIdの配列に変換する
 * @param notionIdProperty - NotionのユニークIDプロパティ値。複数指定する場合はカンマ区切りで指定する。例: "TSK-123, TSK-456"
 */
export const parseNotionUniqueIds = (
  notionIdProperty: string
): NotionUniqueId[] => {
  const notionUniqueIds: NotionUniqueId[] = notionIdProperty
    .split(",")
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

  return notionUniqueIds;
};
