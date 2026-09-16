import { courseName, lessonName } from "./academyCourses.js";

export async function generateImageDescription(imageUrl, context = {}) {
  const selectedCourseName = courseName(context.courseKey);
  const selectedLessonName = lessonName(context.courseKey, context.lessonKey);
  const visibleFocus = context.courseKey === "donor_investor_funding"
    ? "people, project activities, documents, plans, results and other visible project evidence"
    : "tree features, people, tools, soil and activity";
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
              text: `Describe this image in one short factual sentence for the ${selectedCourseName} course, assignment ${selectedLessonName}. Focus on ${visibleFocus}. Do not claim that unseen work was completed.`
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
