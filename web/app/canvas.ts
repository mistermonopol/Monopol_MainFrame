export function homeElements() {
  return [
    {
      id: "home-welcome",
      type: "text",
      title: "",
      options: {
        text: "Welcome to MainFrame.",
        size: 36,
        align: "left",
        bold: true,
      },
      desktop: { order: 0, width: 8, height: 1 },
      mobile: { order: 0, width: 2, height: 1 },
      appearance: {
        header: false,
        border: false,
        background: "none",
        padding: 0,
      },
    },
    {
      id: "home-clock",
      type: "clock",
      title: "",
      options: {
        timezone: "Europe/Berlin",
        format: "both",
        seconds: false,
        size: 28,
      },
      desktop: { order: 1, width: 4, height: 1 },
      mobile: { order: 1, width: 2, height: 1 },
      appearance: {
        header: false,
        border: false,
        background: "none",
        padding: 0,
      },
    },
    {
      id: "home-new-task",
      type: "action",
      title: "New task",
      options: { action: "new_task" },
      desktop: { order: 2, width: 3, height: 1 },
      mobile: { order: 2, width: 1, height: 1 },
      appearance: {
        header: false,
        border: false,
        background: "none",
        padding: 0,
      },
    },
  ];
}
