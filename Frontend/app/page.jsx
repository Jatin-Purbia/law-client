import Studio from "../components/studio";
import { fetchApi } from "../lib/api";
import { toTemplate } from "../lib/templates";

export const dynamic = "force-dynamic";

async function getTemplates() {
  try {
    const result = await fetchApi("/api/templates", {
      cache: "no-store",
    });

    return {
      templates: (result?.data || []).map((template) =>
        toTemplate({
          ...template,
          id: template.templateKey,
        }),
      ),
      templateError: "",
    };
  } catch (error) {
    return {
      templates: [],
      templateError:
        error.message || "Could not load templates right now.",
    };
  }
}

export default async function Page() {
  const { templates, templateError } = await getTemplates();

  return (
    <Studio
      initialTemplates={templates}
      initialTemplateError={templateError}
    />
  );
}