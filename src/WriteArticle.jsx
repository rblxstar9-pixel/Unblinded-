import React, { useEffect, useRef, useState } from "react";
import "./write-article.css";

export default function WriteArticle({ supabase, onClose }) {
  const editor = useRef(null);

  const [user, setUser] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState("মতামত");
  const [cover, setCover] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("প্রস্তুত");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessage("লিখতে লগইন করুন");
        return;
      }
      setUser(user);

      const { data } = await supabase
        .from("article_drafts")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setDraftId(data.id);
        setTitle(data.title || "");
        setSubtitle(data.subtitle || "");
        setCategory(data.category || "মতামত");
        setCover(data.cover_image || "");
        setBody(data.body || "");
        if (editor.current) editor.current.innerHTML = data.body || "";
      }
    }
    load();
  }, [supabase]);

  useEffect(() => {
    if (editor.current && body && editor.current.innerHTML !== body) {
      editor.current.innerHTML = body;
    }
  }, [draftId]);

  async function saveDraft() {
    if (!user) return setMessage("প্রথমে লগইন করুন");
    setSaving(true);
    setMessage("ড্রাফট সংরক্ষণ হচ্ছে...");

    const values = {
      user_id: user.id,
      title,
      subtitle,
      body,
      cover_image: cover,
      category,
      updated_at: new Date().toISOString()
    };

    let result;
    if (draftId) {
      result = await supabase
        .from("article_drafts")
        .update(values)
        .eq("id", draftId)
        .eq("user_id", user.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("article_drafts")
        .insert(values)
        .select()
        .single();
    }

    if (result.error) {
      setMessage("সংরক্ষণ হয়নি: " + result.error.message);
    } else {
      setDraftId(result.data.id);
      setMessage("ড্রাফট সংরক্ষিত ✓");
    }
    setSaving(false);
  }

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(saveDraft, 1800);
    return () => clearTimeout(timer);
  }, [title, subtitle, body, category, cover, user]);

  function format(command, value = null) {
    editor.current?.focus();
    document.execCommand(command, false, value);
    setBody(editor.current?.innerHTML || "");
  }

  async function publish() {
    if (!user) return setMessage("প্রথমে লগইন করুন");
    if (!title.trim()) return setMessage("শিরোনাম লিখুন");
    if (!editor.current?.innerText.trim()) {
      return setMessage("নিবন্ধের মূল লেখা লিখুন");
    }

    setSaving(true);
    setMessage("সম্পাদকের কাছে পাঠানো হচ্ছে...");

    const slug = title.trim().toLowerCase()
      .replace(/[^\w\u0980-\u09FF]+/g, "-")
      .replace(/^-|-$/g, "") + "-" + Date.now();

    const { error } = await supabase.from("articles").insert({
      author_id: user.id,
      title: title.trim(),
      slug,
      category,
      excerpt: editor.current.innerText.trim().slice(0, 180),
      body: editor.current.innerHTML,
      status: "pending"
    });

    if (error) {
      setMessage("প্রকাশ করা যায়নি: " + error.message);
    } else {
      if (draftId) {
        await supabase.from("article_drafts")
          .delete().eq("id", draftId).eq("user_id", user.id);
      }
      setDraftId(null);
      setTitle("");
      setSubtitle("");
      setBody("");
      setCover("");
      if (editor.current) editor.current.innerHTML = "";
      setMessage("সম্পাদকের কাছে পাঠানো হয়েছে ✓");
    }
    setSaving(false);
  }

  return (
    <main className="write-studio">
      <header className="write-topbar">
        <button onClick={onClose}>← ফিরে যান</button>
        <span>UNBLINDED <small>WRITING STUDIO</small></span>
        <div>
          <button onClick={() => setPreview(!preview)}>
            {preview ? "সম্পাদনা" : "প্রিভিউ"}
          </button>
          <button onClick={saveDraft} disabled={saving}>
            {saving ? "সংরক্ষণ..." : "ড্রাফট"}
          </button>
          <button className="publish-button" onClick={publish} disabled={saving}>
            জমা দিন
          </button>
        </div>
      </header>

      <section className="write-paper">
        <div className="write-status">{message}</div>

        {preview ? (
          <article className="article-preview">
            {cover && <img src={cover} alt="Cover" />}
            <p className="preview-category">{category}</p>
            <h1>{title || "আপনার শিরোনাম"}</h1>
            <h3>{subtitle}</h3>
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </article>
        ) : (
          <>
            <input
              className="cover-input"
              placeholder="কভার ছবির URL (ঐচ্ছিক)"
              value={cover}
              onChange={e => setCover(e.target.value)}
            />

            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option>মতামত</option>
              <option>সমাজ</option>
              <option>রাজনীতি</option>
              <option>সাহিত্য</option>
              <option>বিজ্ঞান</option>
              <option>প্রযুক্তি</option>
              <option>দর্শন</option>
              <option>সংস্কৃতি</option>
            </select>

            <input
              className="write-title"
              placeholder="আপনার শিরোনাম..."
              value={title}
              onChange={e => setTitle(e.target.value)}
            />

            <input
              className="write-subtitle"
              placeholder="একটি আকর্ষণীয় উপশিরোনাম..."
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
            />

            <div className="format-toolbar">
              <button onClick={() => format("bold")}><b>B</b></button>
              <button onClick={() => format("italic")}><i>I</i></button>
              <button onClick={() => format("underline")}><u>U</u></button>
              <button onClick={() => format("formatBlock", "h2")}>H2</button>
              <button onClick={() => format("formatBlock", "h3")}>H3</button>
              <button onClick={() => format("formatBlock", "blockquote")}>❝</button>
              <button onClick={() => format("insertUnorderedList")}>• List</button>
              <button onClick={() => format("insertOrderedList")}>1. List</button>
              <button onClick={() => {
                const url = prompt("লিংক দিন");
                if (url) format("createLink", url);
              }}>Link</button>
            </div>

            <div
              ref={editor}
              className="write-editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="আপনার ভাবনা লিখতে শুরু করুন..."
              onInput={e => setBody(e.currentTarget.innerHTML)}
            />
          </>
        )}
      </section>
    </main>
  );
}
