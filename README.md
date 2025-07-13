# Notion のタスクを GitHub の PR と連携する GitHub Actions

Notion のタスクに GitHub PR のリンク情報を連携したり、ステータスを更新する Action。

## 使用例

```yml
# .github/workflows/connect-notion-task.yml
name: Connect Notion Task with GitHub PR

on:
  pull_request:
    types:
      - opened
      - reopened
      - edited
      - review_requested
      - closed

jobs:
  connect-notion-task-with-github-pr:
    runs-on: ubuntu-22.04
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: 変更前のNotion ID Propertyを抽出
        if: github.event.changes.title != null
        id: extract_notion_id_property_before
        run: |
          TITLE="${{ github.event.changes.title.from }}"
          if [[ "$TITLE" =~ ^\[(.+?)\] ]]; then
            NOTION_ID_PROPERTY_BEFORE="${BASH_REMATCH[1]}"
            echo "抽出された変更前のNotion ID Property: $NOTION_ID_PROPERTY_BEFORE"
            echo "VALUE=$NOTION_ID_PROPERTY_BEFORE" >> $GITHUB_OUTPUT
          fi

      - name: Notion ID Propertyを抽出
        id: extract_notion_id_property
        run: |
          TITLE="${{ github.event.pull_request.title }}"
          if [[ "$TITLE" =~ ^\[(.+?)\] ]]; then
            NOTION_ID_PROPERTY="${BASH_REMATCH[1]}"
            echo "抽出されたNotion ID Property: $NOTION_ID_PROPERTY"
            echo "VALUE=$NOTION_ID_PROPERTY" >> $GITHUB_OUTPUT
          fi

      - name: Notionステータスの更新値を設定
        if: steps.extract_notion_id_property.outputs.VALUE != '' || steps.extract_notion_id_property_before.outputs.VALUE != ''
        id: set_notion_status
        run: |
          case "${{ github.event.action }}" in
            opened|reopened)
              STATUS="進行中"
              ;;
            review_requested)
              STATUS="レビュー中"
              ;;
            closed)
              if [[ "${{ github.event.pull_request.merged }}" == 'true' ]]; then
                STATUS="完了"
              fi
              ;;
          esac
          if [[ -n "$STATUS" ]]; then
            echo "更新先のNotionステータス: $STATUS"
            echo "VALUE=$STATUS" >> $GITHUB_OUTPUT
            echo "PROPERTY_NAME=ステータス" >> $GITHUB_OUTPUT
          else
            echo "ステータス更新はありません"
          fi

      - name: Change Notion Task
        if: steps.extract_notion_id_property.outputs.VALUE != '' || steps.extract_notion_id_property_before.outputs.VALUE != ''
        uses: TakanoriOnuma/notion-task-connector-with-github-pr@dist
        # バージョンを固定したい場合は@の後ろをv0.0.0のようにする
        # uses: TakanoriOnuma/notion-task-connector-with-github-pr@v0.0.0
        with:
          beforeNotionIdProperty: ${{ steps.extract_notion_id_property_before.outputs.VALUE }}
          notionIdProperty: ${{ steps.extract_notion_id_property.outputs.VALUE }}
          statusPropertyName: ${{ steps.set_notion_status.outputs.PROPERTY_NAME }}
          statusPropertyValue: ${{ steps.set_notion_status.outputs.VALUE }}
          githubPrPropertyName: "GitHub PR(text)"
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          DATABASE_ID: ${{ vars.DATABASE_ID }}

      - name: Comment Connected Tasks
        if: steps.extract_notion_id_property.outputs.VALUE != '' || steps.extract_notion_id_property_before.outputs.VALUE != ''
        uses: thollander/actions-comment-pull-request@v3
        with:
          file-path: ./connected-tasks.md
          comment-tag: CONNECTED_NOTION_TASKS
```

### 引数

| 名前                   | 説明                                                                                                                                                | 必須か |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| notionIdProperty       | 変更対象の Notion のユニーク ID プロパティ値。複数指定する場合はカンマ区切りで指定する。<br />例: "TSK-123, TSK-456"                                |        |
| beforeNotionIdProperty | 以前指定していた Notion のユニーク ID プロパティ値。notionIdProperty との差分を見て、消えたものについては unlink する。<br />例: "TSK-123, TSK-456" |        |
| statusPropertyName     | 変更するステータスの Notion プロパティ名                                                                                                            |        |
| statusPropertyValue    | 変更後のステータスの Notion プロパティ値                                                                                                            |        |
| githubPrPropertyName   | GitHub PR の Notion プロパティ名                                                                                                                    | ✅     |

#### 環境変数

| 名前         | 説明                     |
| ------------ | ------------------------ |
| NOTION_TOKEN | Notion トークン          |
| DATABASE_ID  | Notion のデータベース ID |

### 出力

`./connected-tasks.md`に PR 上にコメントする関連タスク一覧のメッセージを出力。これを[thollander/actions-comment-pull-request](https://github.com/thollander/actions-comment-pull-request/)などを使ってメッセージ投稿すると楽に関連タスク一覧を PR 上に出力できる。

#### 例

```md
Notion の関連タスク一覧です

- [GitHub Action を使って Notion のプロパティに GitHub PR を紐付ける](https://www.notion.so/GitHub-Action-Notion-GitHub-PR-22907fd5a041803eb572d7a24eff538d)
```
