export const themeDefaults = {
  bg: "#101110",
  panel: "#191b19",
  text: "#f2f3ec",
  muted: "#a7ada5",
  green: "#b6f36c",
  purple: "#bca3ed",
  pink: "#f4b5cc",
};
export const copyDefaults = {
  projectTitle: "Worth a closer look.",
  projectIntro: "A few favourites from the things I’ve been building.",
  projectFullTitle: "The full collection.",
  projectFullIntro: "Different problems. Thoughtful software.",
  aboutTitle: "Curious by default. Builder by choice.",
  toolkitTitle: "The everyday toolkit.",
  skillsTitle: "Tools, not just buzzwords.",
  skillsIntro: "The technical and human skills I bring to a project.",
  journeyTitle: "Every chapter counts.",
  journeyIntro: "The work, the learning, and the people along the way.",
  credentialsTitle: "A work in progress.",
  credentialsIntro: "Learning does not stop at the end of a project.",
  contactTitle: "A good idea needs a good collaborator.",
  heroButton: "Play my story",
  artCaption: "INDEPENDENTLY BUILT. ALWAYS EVOLVING.",
  edition: "THE DEVELOPER EDITION",
  projectsPageTitle: "Less talk. More things built.",
  projectsPageIntro:
    "A collection of practical products, creative experiments, and problems worth solving.",
  skillsPageTitle: "The stack behind the story.",
  skillsPageIntro:
    "Good software takes the right tools, curiosity, and a little persistence.",
  experiencePageTitle: "Not an overnight story.",
  experiencePageIntro:
    "From co-owning a hosting company to studying software engineering. Every chapter adds something.",
  certificatesPageTitle: "Stay curious. Keep going.",
  certificatesPageIntro:
    "A space for qualifications and milestones along the way.",
  contactPageTitle: "Your next collaborator?",
  contactPageIntro:
    "A project, a placement, or a conversation about an idea. I’d love to hear from you.",
};
export const sectionDefaults = [
  "hero",
  "stats",
  "projects",
  "about",
  "experience",
  "contact",
];
export function normalize(data) {
  data.design = {
    theme: {},
    copy: {},
    hiddenSections: [],
    sectionOrder: [...sectionDefaults],
    featuredLimit: 3,
    ...(data.design || {}),
  };
  data.design.theme = { ...themeDefaults, ...data.design.theme };
  data.design.copy = { ...copyDefaults, ...data.design.copy };
  data.design.sectionOrder = [
    ...new Set([...data.design.sectionOrder, ...sectionDefaults]),
  ];
  return data;
}
