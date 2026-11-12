# OpenAI PDF model and pricing reference

Checked against official OpenAI documentation on 2026-11-12. Prices can change; check the linked model pages before configuring or changing a model. Amounts are US dollars per 1 million tokens for standard, uncached API processing; these are API rates, not ChatGPT subscription prices. This is a selection of compatible models, not a complete catalog.

## Suggested model values

The app sends selected pages as a PDF to the OpenAI Responses API and requests structured JSON. The models below document image input, Responses API, and structured outputs support. PDF input includes extracted text and page images; see [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs). Model availability depends on your API account, and these options have not been tested against this app's PDF workload.

| `OPENAI_PDF_MODEL` | Input per 1M | Output per 1M | Practical use |
| --- | ---: | ---: | --- |
| [`gpt-6-luna`](https://developers.openai.com/api/docs/models/gpt-6-luna) | 0.10 | 0.50 | Low-cost starting point; evaluate quiz quality with representative PDFs. |
| [`gpt-5.6-luna`](https://developers.openai.com/api/docs/models/gpt-5.6-luna) | 0.20 | 1.20 | Another cost-sensitive option; check account access. |
| [`gpt-6.1-terra`](https://developers.openai.com/api/docs/models/gpt-6.1-terra) | 1.00 | 5.00 | More expensive option for evaluating difficult visual material. |
| [`gpt-5`](https://developers.openai.com/api/docs/models/gpt-5) | 1.25 | 10.00 | The model shown in `.env.example`; its documented snapshot is deprecated. Check availability and deprecation status before use. |

For the first three models, OpenAI states that requests exceeding 272,000 input tokens are billed at twice the input rate and 1.5 times the output rate for the full request. Other service tiers, caching, cache writes, and regional processing can have different rates. See each linked model page and [API pricing](https://developers.openai.com/api/docs/pricing).

## Example configuration

Copy `.env.example` to `.env`, add your API key, and use all three values from the same row. For example, to try GPT-6 Luna:

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_PDF_MODEL=gpt-6-luna
OPENAI_PDF_INPUT_PRICE_PER_MILLION=0.10
OPENAI_PDF_OUTPUT_PRICE_PER_MILLION=0.50
```

Keep the real API key private. Update both price values whenever you change models or the provider changes its rates. Verify that your account has access, and evaluate the generated drafts for your own documents.

## What the prices do

The app requires both price settings and uses them for estimates, budget reservations, and cost tracking. For returned usage it computes:

```text
estimated cost = (input tokens x input price + output tokens x output price) / 1,000,000
```

For example, 20,000 input tokens and 2,000 output tokens at GPT-6 Luna's standard rates yield `(20,000 x 0.10 + 2,000 x 0.50) / 1,000,000 = $0.003`.

These settings do not control OpenAI's charges. The app uses one input and one output rate and does not separately account for cached input, long-context rates, or other pricing adjustments. Its advance estimates and budget reservations are estimates, not spending caps; actual charges may differ or exceed the budget. PDF page images as well as extracted text count toward input usage, so page count alone does not determine cost. Compare with OpenAI's billing records.
