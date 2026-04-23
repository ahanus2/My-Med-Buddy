import OpenAI from "openai";
import { z } from "zod";

const summarySchema = z.object({
  summary: z.string(),
  important_findings: z.array(z.string()),
  follow_up_steps: z.array(z.string()),
  questions_to_ask: z.array(z.string()),
  warning_flags: z.array(z.string())
});

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function formatSummary(data: z.infer<typeof summarySchema>) {
  const sections = [
    `Summary: ${data.summary}`,
    data.important_findings.length ? `Important findings: ${data.important_findings.join("; ")}` : "",
    data.follow_up_steps.length ? `Follow-up steps: ${data.follow_up_steps.join("; ")}` : "",
    data.questions_to_ask.length ? `Questions to ask: ${data.questions_to_ask.join("; ")}` : "",
    data.warning_flags.length ? `Warning flags: ${data.warning_flags.join("; ")}` : ""
  ].filter(Boolean);

  return sections.join("\n\n");
}

export async function POST(request: Request) {
  try {
    if (!openai) {
      return Response.json(
        { error: "OpenAI is not configured yet. Add OPENAI_API_KEY to your .env.local file." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      type: "record" | "appointment";
      title: string;
      content: string;
    };

    if (!body?.content?.trim()) {
      return Response.json({ error: "There is no text available to summarize yet." }, { status: 400 });
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You summarize medical records for patients in plain, careful language. You are not giving a diagnosis. Be clear, short, and practical. Mention uncertainty when the text is incomplete. Return valid JSON only."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Summarize this ${body.type} for a patient and return JSON with these exact keys: ` +
                `summary, important_findings, follow_up_steps, questions_to_ask, warning_flags.\n\n` +
                `Title: ${body.title}\n\nContent:\n${body.content}`
            }
          ]
        }
      ]
    });

    const rawText = response.output_text?.trim();
    if (!rawText) {
      return Response.json({ error: "The AI summary came back empty." }, { status: 500 });
    }

    const parsed = summarySchema.parse(JSON.parse(rawText));

    return Response.json({
      summary: formatSummary(parsed),
      structured: parsed
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The AI summary request failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
