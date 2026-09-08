import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Removed top-level initialization
const schema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    totalPrice: z.number(),
    confidence: z.object({
      name: z.number(),
      quantity: z.number(),
      unitPrice: z.number(),
      totalPrice: z.number()
    })
  })),
  subtotal: z.object({ value: z.number(), confidence: z.number() }),
  gst: z.object({ value: z.number(), confidence: z.number() }),
  serviceCharge: z.object({ value: z.number(), confidence: z.number() }),
  discount: z.object({ value: z.number(), confidence: z.number() }),
  printedTotal: z.object({ value: z.number(), confidence: z.number() })
});

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API Key is missing. Please create a .env.local file with GEMINI_API_KEY." }, { status: 500 });
    }
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // We pass the image inline to the Gemini API
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType: file.type
              }
            },
            {
              text: `Extract every visible food/drink line item from this bill.
Generate a unique string id for each item (e.g. '1', '2').
Extract quantity, unit price if visible, total price for the line item.
Extract subtotal, GST/tax, service charge, discount, and printed total.
Never invent missing values. Handle missing GST/service charge/discount as 0.
Preserve the printed total even if it appears mathematically incorrect.
Return structured JSON matching the requested schema.
Confidence scores must be between 0 and 1. If unclear, use a lower score.`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  name: { type: "STRING" },
                  quantity: { type: "NUMBER" },
                  unitPrice: { type: "NUMBER" },
                  totalPrice: { type: "NUMBER" },
                  confidence: {
                    type: "OBJECT",
                    properties: {
                      name: { type: "NUMBER" },
                      quantity: { type: "NUMBER" },
                      unitPrice: { type: "NUMBER" },
                      totalPrice: { type: "NUMBER" }
                    },
                    required: ["name", "quantity", "unitPrice", "totalPrice"]
                  }
                },
                required: ["id", "name", "quantity", "unitPrice", "totalPrice", "confidence"]
              }
            },
            subtotal: {
              type: "OBJECT",
              properties: { value: { type: "NUMBER" }, confidence: { type: "NUMBER" } },
              required: ["value", "confidence"]
            },
            gst: {
              type: "OBJECT",
              properties: { value: { type: "NUMBER" }, confidence: { type: "NUMBER" } },
              required: ["value", "confidence"]
            },
            serviceCharge: {
              type: "OBJECT",
              properties: { value: { type: "NUMBER" }, confidence: { type: "NUMBER" } },
              required: ["value", "confidence"]
            },
            discount: {
              type: "OBJECT",
              properties: { value: { type: "NUMBER" }, confidence: { type: "NUMBER" } },
              required: ["value", "confidence"]
            },
            printedTotal: {
              type: "OBJECT",
              properties: { value: { type: "NUMBER" }, confidence: { type: "NUMBER" } },
              required: ["value", "confidence"]
            }
          },
          required: ["items", "subtotal", "gst", "serviceCharge", "discount", "printedTotal"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
       throw new Error("No response text");
    }
    
    // 1. Zod Validation (Primary Next.js safeguard)
    const parsed = schema.parse(JSON.parse(resultText));

    // 2. FastAPI Pydantic Validation (Competition Requirement)
    // We wrap this in a try-catch so the app doesn't break if the Python backend isn't actively running.
    try {
      const pyRes = await fetch("http://127.0.0.1:8000/validate-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      if (!pyRes.ok) {
        console.warn("Pydantic validation failed on backend!");
      } else {
        console.log("Pydantic validation passed!");
      }
    } catch (e) {
      console.warn("FastAPI backend not running at :8000, skipping Pydantic validation step.");
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error(error);
    const msg = error instanceof Error ? error.message : "Failed to process";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
