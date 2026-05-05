import fetch from "node-fetch";

export async function generateImageDescription(imageUrl) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Describe this image in one short sentence for a tree planting project. Focus on trees, people, and activity."
            },
            {
              type: "input_image",
              image_url: imageUrl
            }
          ]
        }
      ]
    })
  });

  const data = await res.json();

  return data.output?.[0]?.content?.[0]?.text || null;
}
