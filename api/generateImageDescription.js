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

  console.log("OpenAI raw response:", JSON.stringify(data).slice(0, 1000));

  if (!res.ok) {
    console.log("OpenAI error:", data);
    return null;
  }

  return data.output_text || null;
}
