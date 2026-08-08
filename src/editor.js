import { Editor } from "@tiptap/core";
import Details, { DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";

const editorExtensions = [
    StarterKit.configure({ blockquote: false, code: false, codeBlock: false, dropcursor: false, gapcursor: false, hardBreak: false, italic: false, link: false, strike: false, underline: false, undoRedo: false, heading: { levels: [1, 2] } }),
    Highlight.configure({ multicolor: false }),
    Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, protocols: ["http", "https"] }),
    Placeholder.configure({ placeholder: "Start writing…" }),
    Details.configure({ persist: true, HTMLAttributes: { class: "research-details" } }),
    DetailsSummary,
    DetailsContent,
    TaskList,
    TaskItem.configure({ nested: true })
];

const toolbarIcons = {
    heading: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5v14M4 12h7M11 5v14M16 9l2-2v12"/></svg>',
    subheading: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5v14M4 12h7M11 5v14M16 9l3-2v12"/></svg>',
    section: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 3 3-3 3M13 7h6M13 12h6M13 17h6"/></svg>',
    bold: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h5a3 3 0 0 1 0 6H7zm0 6h6a3.5 3.5 0 0 1 0 7H7z"/></svg>',
    bulletList: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h10M9 12h10M9 18h10"/><path d="M5 6h.01M5 12h.01M5 18h.01"/></svg>',
    checklist: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 6 1.5 1.5L8 5M11 6h8M4 12l1.5 1.5L8 11M11 12h8M4 18l1.5 1.5L8 17M11 18h8"/></svg>',
    highlight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 4 6 6M4 20h8M6 16l8-8 4 4-8 8H6z"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>',
    divider: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>'
};

function createToolbarButton({ icon, title, action, isActive }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "editor-toolbar-button";
    button.innerHTML = icon;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", action);
    return { button, isActive };
}

class ResearchDeskEditor {
    constructor() {
        this.editor = null;
        this.toolbar = null;
        this.toolbarButtons = [];
    }

    mount({ element, toolbar, content, onUpdate }) {
        this.destroy();
        this.toolbar = toolbar;
        this.editor = new Editor({
            element,
            extensions: editorExtensions,
            content,
            editorProps: { attributes: { class: "research-desk-editor", "aria-label": "Research notes" } },
            onCreate: ({ editor }) => {
                if (typeof content === "string" && content.trim()) onUpdate(editor.getJSON());
                this.updateToolbar();
            },
            onUpdate: ({ editor }) => onUpdate(editor.getJSON()),
            onSelectionUpdate: () => this.updateToolbar(),
            onTransaction: () => this.updateToolbar()
        });
        this.renderToolbar();
    }

    destroy() {
        if (this.editor) this.editor.destroy();
        this.editor = null;
        this.toolbarButtons = [];
        if (this.toolbar) this.toolbar.replaceChildren();
        this.toolbar = null;
    }

    renderToolbar() {
        if (!this.editor || !this.toolbar) return;
        const controls = [
            [toolbarIcons.heading, "H1 — Heading", () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(), () => this.editor.isActive("heading", { level: 1 })],
            [toolbarIcons.subheading, "H2 — Subheading", () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(), () => this.editor.isActive("heading", { level: 2 })],
            [toolbarIcons.section, "Collapsible section", () => this.editor.chain().focus().setDetails().run(), () => this.editor.isActive("details")],
            [toolbarIcons.bold, "Bold", () => this.editor.chain().focus().toggleBold().run(), () => this.editor.isActive("bold")],
            [toolbarIcons.bulletList, "Bullet list", () => this.editor.chain().focus().toggleBulletList().run(), () => this.editor.isActive("bulletList")],
            [toolbarIcons.checklist, "Checklist", () => this.editor.chain().focus().toggleTaskList().run(), () => this.editor.isActive("taskList")],
            [toolbarIcons.highlight, "Highlight", () => this.editor.chain().focus().toggleHighlight().run(), () => this.editor.isActive("highlight")],
            [toolbarIcons.link, "Add or remove link", () => this.toggleLink(), () => this.editor.isActive("link")],
            [toolbarIcons.divider, "Horizontal divider", () => this.editor.chain().focus().setHorizontalRule().run(), () => false]
        ];
        this.toolbarButtons = controls.map(([icon, title, action, isActive]) => createToolbarButton({ icon, title, action, isActive }));
        this.toolbar.replaceChildren(...this.toolbarButtons.map(({ button }) => button));
        this.updateToolbar();
    }

    toggleLink() {
        if (this.editor.isActive("link")) {
            this.editor.chain().focus().unsetLink().run();
            return;
        }
        const url = window.prompt("Enter a URL", "https://");
        if (!url) return;
        try {
            const parsedUrl = new URL(url);
            if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Unsupported protocol");
            this.editor.chain().focus().extendMarkRange("link").setLink({ href: parsedUrl.href }).run();
        } catch (error) {
            window.alert("Enter a valid http or https URL.");
        }
    }

    updateToolbar() {
        this.toolbarButtons.forEach(({ button, isActive }) => button.classList.toggle("is-active", Boolean(isActive())));
    }
}

window.ResearchDeskEditor = ResearchDeskEditor;
