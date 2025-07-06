import * as core from "@actions/core";
import { context } from "@actions/github";
import { changeNotionProperty } from "../src/changeNotionProperty";

export async function run(): Promise<void> {
  const prPayload = context.payload.pull_request;
  if (prPayload == null) {
    core.setFailed("Pull request payload is not available.");
    return;
  }

  const notionIdProperty = core.getInput("notionIdProperty", {
    required: true,
  });
  const statusPropertyName = core.getInput("statusPropertyName") || undefined;
  const statusPropertyValue = core.getInput("statusPropertyValue") || undefined;
  const githubPrPropertyName = core.getInput("githubPrPropertyName", {
    required: true,
  });

  await changeNotionProperty({
    notionIdProperty,
    statusProperty:
      statusPropertyName && statusPropertyValue
        ? {
            name: statusPropertyName,
            value: statusPropertyValue,
          }
        : undefined,
    githubPrProperty: {
      name: githubPrPropertyName,
      value: {
        title: prPayload.title,
        url: prPayload.html_url ?? prPayload.url,
      },
    },
  });
}
