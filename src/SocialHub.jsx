import React, { useEffect, useMemo, useState } from "react";
import { Heart, MessageCircle, Send, UserRound, Pencil, RefreshCw } from "lucide-react";
import "./social-hub.css";

const initials = value => (value || "U").trim().slice(0, 1).toUpperCase();
const dateLabel = value => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Just now";

export default function SocialHub({ supabase, session, profile }) {
  const userId = session?.user?.id;
  const [tab, setTab] = useState("feed");
  const [posts, setPosts] = useState([]);
  const [draft, setDraft] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("Bangladesh");
  const [interests, setInterests] = useState("");
  const [liked, setLiked] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const name = profile?.display_name || session?.user?.email?.split("@")[0] || "Member";

  const notify = message => { setNotice(message); window.setTimeout(() => setNotice(""), 3000); };
  async function loadFeed() {
    const { data, error } = await supabase.from("social_posts")
      .select("id,author_id,body,created_at,profiles(display_name,avatar_url),social_post_comments(id,body,created_at,profiles(display_name))")
      .order("created_at", { ascending: false }).limit(50);
    if (error) notify(error.message);
    else setPosts(data || []);
    const { data: reactions } = await supabase.from("social_post_reactions")
      .select("post_id").eq("user_id", userId);
    setLiked(Object.fromEntries((reactions || []).map(item => [item.post_id, true])));
  }
  async function loadProfile() {
    const { data, error } = await supabase.from("social_profiles").select("bio,location,interests").eq("user_id", userId).maybeSingle();
    if (error) notify(error.message);
    if (data) { setBio(data.bio || ""); setLocation(data.location || "Bangladesh"); setInterests(data.interests || ""); }
  }
  useEffect(() => { if (userId) { loadFeed(); loadProfile(); } }, [userId]);

  async function publish(event) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.from("social_posts").insert({ author_id: userId, body: draft.trim() });
    setBusy(false);
    if (error) notify(error.message);
    else { setDraft(""); await loadFeed(); notify("Your post is live."); }
  }
  async function toggleLike(post) {
    const wasLiked = !!liked[post.id];
    setLiked(current => ({ ...current, [post.id]: !wasLiked }));
    const result = wasLiked
      ? await supabase.from("social_post_reactions").delete().eq("post_id", post.id).eq("user_id", userId)
      : await supabase.from("social_post_reactions").insert({ post_id: post.id, user_id: userId, reaction: "like" });
    if (result.error) { setLiked(current => ({ ...current, [post.id]: wasLiked })); notify(result.error.message); }
    else await loadFeed();
  }
  async function comment(event, post) {
    event.preventDefault();
    const body = (commentDrafts[post.id] || "").trim();
    if (!body) return;
    const { error } = await supabase.from("social_post_comments").insert({ post_id: post.id, author_id: userId, body });
    if (error) notify(error.message);
    else { setCommentDrafts(current => ({ ...current, [post.id]: "" })); await loadFeed(); }
  }
  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("social_profiles").upsert({
      user_id: userId, bio: bio.trim(), location: location.trim(), interests: interests.trim(), updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    setBusy(false);
    notify(error?.message || "Profile saved.");
  }
  const sortedPosts = useMemo(() => posts, [posts]);

  return <section className="social-hub">
    <div className="social-heading">
      <div><span className="eyebrow">UNBLINDED / CONNECT</span><h2>Your social space</h2><p>Share ideas, meet people and build thoughtful conversations.</p></div>
      <div className="social-tabs">
        <button className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}><MessageCircle size={15}/> Feed</button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound size={15}/> My profile</button>
      </div>
    </div>
    {notice && <div className="social-notice" role="status">{notice}</div>}
    {tab === "feed" ? <div className="social-layout">
      <div className="social-feed-column">
        <form className="social-composer" onSubmit={publish}>
          <div className="social-avatar">{initials(name)}</div>
          <div className="social-composer-main"><textarea value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} placeholder="What’s on your mind? Share an idea, question or discovery…" rows={3}/><div className="social-composer-footer"><small>{draft.length}/2000</small><button className="primary-button" disabled={!draft.trim() || busy}><Send size={14}/> {busy ? "Posting…" : "Publish"}</button></div></div>
        </form>
        <div className="social-feed-tools"><b>Latest conversations</b><button onClick={loadFeed}><RefreshCw size={14}/> Refresh</button></div>
        {sortedPosts.map(post => <article className="social-post" key={post.id}>
          <div className="social-post-author"><div className="social-avatar">{initials(post.profiles?.display_name)}</div><div><b>{post.profiles?.display_name || "UNBLINDED member"}</b><small>{dateLabel(post.created_at)}</small></div></div>
          <p className="social-post-body">{post.body}</p>
          <div className="social-post-actions"><button className={liked[post.id] ? "liked" : ""} onClick={() => toggleLike(post)}><Heart size={16} fill={liked[post.id] ? "currentColor" : "none"}/> {liked[post.id] ? "Liked" : "Like"}</button><span><MessageCircle size={15}/> {post.social_post_comments?.length || 0} comments</span></div>
          {!!post.social_post_comments?.length && <div className="social-comments">{post.social_post_comments.map(item => <div key={item.id}><b>{item.profiles?.display_name || "Member"}</b><span>{item.body}</span></div>)}</div>}
          <form className="social-comment-form" onSubmit={event => comment(event, post)}><input value={commentDrafts[post.id] || ""} onChange={e => setCommentDrafts(current => ({ ...current, [post.id]: e.target.value }))} placeholder="Write a thoughtful reply…"/><button aria-label="Send comment"><Send size={15}/></button></form>
        </article>)}
        {!posts.length && <div className="social-empty"><MessageCircle size={25}/><b>Start the conversation</b><span>Your feed is quiet. Publish the first post.</span></div>}
      </div>
      <aside className="social-side-card"><div className="social-profile-cover"/><div className="social-side-avatar">{initials(name)}</div><h3>{name}</h3><p>{bio || "Add a short introduction to help people get to know you."}</p><button className="secondary-button" onClick={() => setTab("profile")}>Edit profile</button><div className="social-side-note">A space for curiosity, respect and good ideas.</div></aside>
    </div> : <form className="social-profile-editor" onSubmit={saveProfile}>
      <div className="social-profile-preview"><div className="social-profile-cover"/><div className="social-profile-avatar">{initials(name)}</div><div><h3>{name}</h3><span>{session?.user?.email}</span></div></div>
      <label>About you<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={280} rows={4} placeholder="A little about yourself, what you care about, or what you're learning…"/></label>
      <label>Location<input value={location} onChange={e => setLocation(e.target.value)} maxLength={100} placeholder="City, Bangladesh"/></label>
      <label>Interests<input value={interests} onChange={e => setInterests(e.target.value)} maxLength={240} placeholder="e.g. science, philosophy, literature, programming"/></label>
      <div className="social-profile-actions"><small>Your email stays private. Only the profile details above are stored here.</small><button className="primary-button" disabled={busy}><Pencil size={14}/> {busy ? "Saving…" : "Save profile"}</button></div>
    </form>}
  </section>;
}
