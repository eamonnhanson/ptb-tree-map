export const DEFAULT_ACADEMY_COURSE = "online_tree_planting";

export const ACADEMY_COURSES = Object.freeze({
  online_tree_planting: {
    name: "Online tree planting",
    requiredLessons: [
      "lesson_1_child_protection", "lesson_2_climate_change", "lesson_3_tree_health",
      "lesson_4_tree_planting", "lesson_5_carbon_dioxide_increase",
      "lesson_6_soil_condition", "lesson_7_mulching", "lesson_8_erosion_control"
    ],
    lessons: {
      onboarding: "Onboarding",
      lesson_1_child_protection: "Lesson 1: Child Protection",
      lesson_1_climate_change: "Lesson 1: Climate Change",
      lesson_2_climate_change: "Lesson 2: Climate Change",
      lesson_2_tree_health: "Lesson 2: Tree Health",
      lesson_3_tree_health: "Lesson 3: Tree Health",
      lesson_3_tree_planting: "Lesson 3: Tree Planting",
      lesson_4_tree_planting: "Lesson 4: Tree Planting",
      lesson_4_co2_increase: "Lesson 4: Carbon Dioxide Increase",
      lesson_5_carbon_dioxide_increase: "Lesson 5: Carbon Dioxide Increase",
      lesson_6_soil_condition: "Lesson 6: Soil Condition",
      lesson_7_mulching: "Lesson 7: Mulching",
      lesson_8_erosion_control: "Lesson 8: Erosion Control",
      tutor_question: "Question to the tutor",
      evaluation: "Evaluation"
    }
  },
  arboriculture_1: {
    name: "Arboriculture I",
    requiredLessons: [
      "arb1_module_1_tree_biology", "arb1_module_2_tree_identification",
      "arb1_module_3_soil_and_roots", "arb1_module_4_tree_selection",
      "arb1_module_5_tree_planting", "arb1_module_6_tree_care",
      "arb1_module_7_tree_health", "arb1_module_8_pruning"
    ],
    lessons: {
      onboarding: "Onboarding",
      arb1_module_1_tree_biology: "Module 1: Tree biology and young tree failure",
      arb1_module_2_tree_identification: "Module 2: Tree identification",
      arb1_module_3_soil_and_roots: "Module 3: Soil and roots",
      arb1_module_4_tree_selection: "Module 4: Choosing the right tree",
      arb1_module_5_tree_planting: "Module 5: Tree planting",
      arb1_module_6_tree_care: "Module 6: Young tree care",
      arb1_module_7_tree_health: "Module 7: Tree health assessment",
      arb1_module_8_pruning: "Module 8: Basic pruning",
      tutor_question: "Question to the tutor",
      evaluation: "Evaluation"
    }
  }
});

export function normalizeCourseKey(value) {
  const key = String(value || "").trim().toLowerCase();
  return ACADEMY_COURSES[key] ? key : DEFAULT_ACADEMY_COURSE;
}

export function isKnownCourse(value) {
  return Boolean(ACADEMY_COURSES[String(value || "").trim().toLowerCase()]);
}

export function isKnownLesson(courseKey, lessonKey) {
  if (!lessonKey) return false;
  return Boolean(ACADEMY_COURSES[normalizeCourseKey(courseKey)]?.lessons?.[lessonKey]);
}

export function courseName(courseKey) {
  return ACADEMY_COURSES[normalizeCourseKey(courseKey)].name;
}

export function lessonName(courseKey, lessonKey) {
  return ACADEMY_COURSES[normalizeCourseKey(courseKey)].lessons[lessonKey] || lessonKey || "Not selected";
}
