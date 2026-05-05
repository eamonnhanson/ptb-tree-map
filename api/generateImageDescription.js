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

if (!res.ok) {
  console.log("OpenAI error:", data);
  return null;
}

const text =
  data.output_text ||
  data.output?.[0]?.content?.find(c => c.type === "output_text")?.text ||
  data.output?.[0]?.content?.[0]?.text ||
  null;

return text;
}
