// Fixed roster. Assignees are picked from this list rather than typed, so the
// same person is always spelled the same way.
const MEMBERS = [
  { name: "권혜인", teamId: "management", lead: true },

  { name: "천경진", teamId: "design", lead: true },
  { name: "허준우", teamId: "design" },
  { name: "하채윤", teamId: "design" },

  { name: "전지호", teamId: "frontend", lead: true },
  { name: "권도형", teamId: "frontend" },
  { name: "조경화", teamId: "frontend" },

  { name: "문시원", teamId: "backend", lead: true },
  { name: "노여진", teamId: "backend" },

  { name: "김정엽", teamId: "native" },

  { name: "이창수", teamId: "infra", lead: true },
  { name: "오영식", teamId: "infra" },
  { name: "김현경", teamId: "infra" },
  { name: "한지우", teamId: "infra" },

  { name: "박지혜", teamId: "security", lead: true },
  { name: "곽형민", teamId: "security" },
  { name: "이정재", teamId: "security" },
  { name: "신동일", teamId: "security" },

  { name: "성화섭", teamId: "genai", lead: true },
  { name: "서지우", teamId: "genai" },
  { name: "김형은", teamId: "genai" },
];

module.exports = { MEMBERS };
