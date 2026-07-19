export async function generateImageDescription(imageUrl, context = {}) {
  const courseName = context.courseKey === "arboriculture_1"
    ? "Arboriculture I"
    : "Online tree planting";
  const lessonKey = String(context.lessonKey || "general activity");
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
              text: `Describe this image in one short factual sentence for the ${courseName} course, assignment ${lessonKey}. Focus on visible tree features, people, tools, soil and activity. Do not claim that unseen work was completed.`
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

 return (
  data.output_text ||
  data.output?.[0]?.content?.[0]?.text ||
  null
);
}
