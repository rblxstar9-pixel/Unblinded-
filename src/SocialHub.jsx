import React, { useEffect, useMemo, useState } from "react";
import {
  Heart, MessageCircle, Send, Bookmark, ImagePlus, Search,
  Compass, Plus, RefreshCw, Trash2, X, UserPlus
} from "lucide-react";
import "./social-hub.css";

const getInitial = (name) => (name || "U").trim()[0].toUpperCase();

const formatDate = (date) =>
  new Date(date).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });

export default function SocialHub({ supabase, session, profile }) {
  const userId = session?.user?.id;
  const username =
    profile?.display_name ||
    session?.user?.email?.split("@")[0] ||
    "Member";

  const [page, setPage] = useState("home");
  const [feedType, setFeedType] = useState("all");
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [following, setFollowing] = useState([]);
  const [saved, setSaved] = useState([]);
  const [counts, setCounts] = useState({
    posts: 0, followers: 0, following: 0
  });
  const [search, setSearch] = useState("");
  const [postText, setPostText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [comments, setComments] = useState({});
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeStory, setActiveStory] = useState(null);

  const [socialProfile, setSocialProfile] = useState({
    bio: "",
    location: "Bangladesh",
    interests: "",
    website: "",
    is_private: false
  });

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  };

  async function loadData() {
    if (!userId || !supabase) return;

    const [
      postResult,
      storyResult,
      followResult,
      savedResult,
      profileResult
    ] = await Promise.all([
      supabase.from("social_posts")
        .select(`
          *,
          profiles:author_id(display_name,avatar_url),
          social_post_reactions(user_id),
          social_post_comments(
            id,body,author_id,created_at,
            profiles:author_id(display_name,avatar_url)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50),

      supabase.from("social_stories")
        .select("*, profiles:user_id(display_name,avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),

      supabase.from("social_follows")
        .select("following_id")
        .eq("follower_id", userId),

      supabase.from("social_saved_posts")
        .select("post_id")
        .eq("user_id", userId),

      supabase.from("social_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()
    ]);

    if (postResult.error) notify(postResult.error.message);
    else setPosts(postResult.data || []);

    setStories(storyResult.data || []);
    setFollowing((followResult.data || []).map(x => x.following_id));
    setSaved((savedResult.data || []).map(x => x.post_id));

    if (profileResult.data) {
      setSocialProfile({
        bio: profileResult.data.bio || "",
        location: profileResult.data.location || "Bangladesh",
        interests: profileResult.data.interests || "",
        website: profileResult.data.website || "",
        is_private: !!profileResult.data.is_private
      });
    }

    const [followers, followingCount, postCount] = await Promise.all([
      supabase.from("social_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId),

      supabase.from("social_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId),

      supabase.from("social_posts")
        .select("*", { count: "exact", head: true })
        .eq("author_id", userId)
    ]);

    setCounts({
      followers: followers.count || 0,
      following: followingCount.count || 0,
      posts: postCount.count || 0
    });

    const { data: people } = await supabase.from("profiles")
      .select("id,display_name,avatar_url")
      .neq("id", userId)
      .limit(20);

    const followed = new Set(
      (followResult.data || []).map(x => x.following_id)
    );

    setSuggestions(
      (people || []).filter(person => !followed.has(person.id)).slice(0, 6)
    );
  }

  useEffect(() => {
    loadData();
  }, [userId]);

  const visiblePosts = useMemo(() => {
    let result = [...posts];

    if (page === "saved") {
      result = result.filter(post => saved.includes(post.id));
    }

    if (feedType === "following") {
      result = result.filter(post =>
        following.includes(post.author_id) || post.author_id === userId
      );
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(post =>
        (post.body || "").toLowerCase().includes(term) ||
        (post.profiles?.display_name || "").toLowerCase().includes(term)
      );
    }

    return result;
  }, [posts, page, saved, feedType, following, userId, search]);
    async function publishPost(event) {
    event.preventDefault();

    if (!postText.trim() && !selectedMedia) return;

    setLoading(true);

    let mediaUrl = null;
    let mediaType = null;

    if (selectedMedia) {
      const extension = selectedMedia.name.split(".").pop();
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;

      const upload = await supabase.storage
        .from("social-media")
        .upload(path, selectedMedia, {
          contentType: selectedMedia.type
        });

      if (upload.error) {
        setLoading(false);
        notify(upload.error.message);
        return;
      }

      mediaUrl = supabase.storage
        .from("social-media")
        .getPublicUrl(path).data.publicUrl;

      mediaType = selectedMedia.type.startsWith("video/")
        ? "video"
        : "image";
    }

    const { error } = await supabase.from("social_posts").insert({
      author_id: userId,
      body: postText.trim(),
      media_url: mediaUrl,
      media_type: mediaType,
      visibility
    });

    setLoading(false);

    if (error) {
      notify(error.message);
      return;
    }

    setPostText("");
    setSelectedMedia(null);
    setMediaPreview("");
    await loadData();
    notify("Your post is live.");
  }

  async function toggleLike(post) {
    const liked = (post.social_post_reactions || [])
      .some(reaction => reaction.user_id === userId);

    const result = liked
      ? await supabase.from("social_post_reactions")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", userId)
      : await supabase.from("social_post_reactions")
          .insert({
            post_id: post.id,
            user_id: userId,
            reaction: "like"
          });

    if (result.error) notify(result.error.message);
    else loadData();
  }

  async function addComment(event, post) {
    event.preventDefault();

    const body = (comments[post.id] || "").trim();
    if (!body) return;

    const { error } = await supabase
      .from("social_post_comments")
      .insert({
        post_id: post.id,
        author_id: userId,
        body
      });

    if (error) notify(error.message);
    else {
      setComments(old => ({ ...old, [post.id]: "" }));
      loadData();
    }
  }

  async function toggleSave(post) {
    const isSaved = saved.includes(post.id);

    const result = isSaved
      ? await supabase.from("social_saved_posts")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", userId)
      : await supabase.from("social_saved_posts")
          .insert({
            user_id: userId,
            post_id: post.id
          });

    if (result.error) notify(result.error.message);
    else loadData();
  }

  async function toggleFollow(person) {
    const isFollowing = following.includes(person.id);

    const result = isFollowing
      ? await supabase.from("social_follows")
          .delete()
          .eq("follower_id", userId)
          .eq("following_id", person.id)
      : await supabase.from("social_follows")
          .insert({
            follower_id: userId,
            following_id: person.id
          });

    if (result.error) notify(result.error.message);
    else loadData();
  }

  async function deletePost(post) {
    if (post.author_id !== userId) return;
    if (!window.confirm("Delete this post?")) return;

    const { error } = await supabase
      .from("social_posts")
      .delete()
      .eq("id", post.id);

    if (error) notify(error.message);
    else loadData();
  }

  async function saveProfile(event) {
    event.preventDefault();

    const { error } = await supabase
      .from("social_profiles")
      .upsert({
        user_id: userId,
        ...socialProfile,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (error) notify(error.message);
    else {
      notify("Profile updated.");
      loadData();
      setPage("profile");
    }
  }

  async function createStory(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") &&
        !file.type.startsWith("video/")) {
      notify("Choose an image or video.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      notify("The maximum story size is 50 MB.");
      return;
    }

    setLoading(true);

    const extension = file.name.split(".").pop();
    const path = `${userId}/story-${crypto.randomUUID()}.${extension}`;

    const upload = await supabase.storage
      .from("social-media")
      .upload(path, file, { contentType: file.type });

    if (upload.error) {
      setLoading(false);
      notify(upload.error.message);
      return;
    }

    const url = supabase.storage
      .from("social-media")
      .getPublicUrl(path).data.publicUrl;

    const { error } = await supabase.from("social_stories").insert({
      user_id: userId,
      media_url: url,
      media_type: file.type.startsWith("video/") ? "video" : "image",
      expires_at: new Date(Date.now() + 86400000).toISOString()
    });

    setLoading(false);

    if (error) notify(error.message);
    else {
      await loadData();
      notify("Story added for 24 hours.");
    }

    event.target.value = "";
}
    return (
    <section className="social-hub">
      <header className="sh-top">
        <div>
          <span className="sh-kicker">UNBLINDED / SOCIAL</span>
          <h2>Connect with your world.</h2>
          <p>Share moments, ideas and things worth discovering.</p>
        </div>

        <div className="sh-search">
          <Search size={16}/>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search people and posts"
          />
        </div>
      </header>

      <nav className="sh-nav">
        {[
          ["home", "Home"],
          ["explore", "Explore"],
          ["saved", "Saved"],
          ["profile", "My profile"]
        ].map(([id, label]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => setPage(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {notice && <div className="sh-toast">{notice}</div>}

      {page === "edit-profile" && (
        <form className="sh-editor" onSubmit={saveProfile}>
          <h3>Edit your profile</h3>

          <label>
            Bio
            <textarea
              maxLength={280}
              value={socialProfile.bio}
              onChange={e => setSocialProfile(v => ({
                ...v, bio: e.target.value
              }))}
            />
          </label>

          <label>
            Location
            <input
              value={socialProfile.location}
              onChange={e => setSocialProfile(v => ({
                ...v, location: e.target.value
              }))}
            />
          </label>

          <label>
            Interests
            <input
              value={socialProfile.interests}
              onChange={e => setSocialProfile(v => ({
                ...v, interests: e.target.value
              }))}
            />
          </label>

          <label>
            Website
            <input
              type="url"
              value={socialProfile.website}
              placeholder="https://..."
              onChange={e => setSocialProfile(v => ({
                ...v, website: e.target.value
              }))}
            />
          </label>

          <label className="sh-check">
            <input
              type="checkbox"
              checked={socialProfile.is_private}
              onChange={e => setSocialProfile(v => ({
                ...v, is_private: e.target.checked
              }))}
            />
            Private account preference
          </label>

          <button className="sh-primary">Save profile</button>
        </form>
      )}

      {page === "profile" && (
        <section className="sh-profile-page">
          <div className="sh-profile-banner">
            <div className="sh-profile-avatar">
              {getInitial(username)}
            </div>
          </div>

          <div className="sh-profile-head">
            <div>
              <h2>{username}</h2>
              <p>
                {socialProfile.bio || "Tell the world about yourself."}
              </p>
              <small>
                {socialProfile.location}
                {socialProfile.website && ` · ${socialProfile.website}`}
              </small>
            </div>

            <button
              className="sh-primary"
              onClick={() => setPage("edit-profile")}
            >
              Edit profile
            </button>
          </div>

          <div className="sh-stats">
            <div><b>{counts.posts}</b><span>Posts</span></div>
            <div><b>{counts.followers}</b><span>Followers</span></div>
            <div><b>{counts.following}</b><span>Following</span></div>
          </div>

          <div className="sh-grid">
            {posts.filter(post => post.author_id === userId).map(post => (
              <button key={post.id} onClick={() => setPage("home")}>
                {post.media_url
                  ? <img src={post.media_url} alt="Post"/>
                  : <span>{post.body}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {page !== "profile" && page !== "edit-profile" && (
        <div className="sh-columns">
          <main className="sh-main">

            {page === "home" && (
              <div className="sh-stories">
                <label className="sh-story-add">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={createStory}
                  />
                  <span className="sh-add-circle"><Plus/></span>
                  <small>Your story</small>
                </label>

                {stories.map(story => (
                  <button
                    className="sh-story"
                    key={story.id}
                    onClick={() => setActiveStory(story)}
                  >
                    <span>
                      <b>{getInitial(story.profiles?.display_name)}</b>
                    </span>
                    <small>
                      {story.profiles?.display_name || "Member"}
                    </small>
                  </button>
                ))}
              </div>
            )}

            {page === "home" && (
              <form className="sh-composer" onSubmit={publishPost}>
                <div className="sh-compose-row">
                  <div className="sh-avatar">
                    {getInitial(username)}
                  </div>

                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={postText}
                    onChange={e => setPostText(e.target.value)}
                    placeholder="Share something with your community..."
                  />
                </div>

                {mediaPreview && (
                  <div className="sh-media-preview">
                    <img src={mediaPreview} alt="Selected media"/>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMedia(null);
                        setMediaPreview("");
                      }}
                    >
                      <X/>
                    </button>
                  </div>
                )}

                <div className="sh-compose-footer">
                  <label className="sh-media-pick">
                    <ImagePlus size={17}/> Photo / video
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedMedia(file);
                          setMediaPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>

                  <select
                    value={visibility}
                    onChange={e => setVisibility(e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="followers">Followers</option>
                  </select>

                  <button
                    className="sh-primary"
                    disabled={loading || (!postText.trim() && !selectedMedia)}
                  >
                    {loading ? "Publishing..." : "Share post"}
                  </button>
                </div>
              </form>
            )}
                        <div className="sh-feed-switch">
              <div>
                <b>
                  {page === "saved" ? "Saved posts" :
                   page === "explore" ? "Explore" : "Your feed"}
                </b>
                <small>{visiblePosts.length} posts</small>
              </div>

              {page === "home" && (
                <div>
                  <button
                    className={feedType === "all" ? "on" : ""}
                    onClick={() => setFeedType("all")}
                  >
                    For you
                  </button>
                  <button
                    className={feedType === "following" ? "on" : ""}
                    onClick={() => setFeedType("following")}
                  >
                    Following
                  </button>
                </div>
              )}

              <button className="sh-icon-btn" onClick={loadData}>
                <RefreshCw size={15}/>
              </button>
            </div>

            {visiblePosts.map(post => {
              const postLiked = (post.social_post_reactions || [])
                .some(reaction => reaction.user_id === userId);

              const likeCount = post.social_post_reactions?.length || 0;
              const commentList = post.social_post_comments || [];

              return (
                <article className="sh-post" key={post.id}>
                  <div className="sh-post-head">
                    <div className="sh-avatar">
                      {getInitial(post.profiles?.display_name)}
                    </div>

                    <div>
                      <b>
                        {post.profiles?.display_name || "UNBLINDED member"}
                      </b>
                      <small>
                        {formatDate(post.created_at)} · {post.visibility}
                      </small>
                    </div>

                    {post.author_id === userId && (
                      <button
                        className="sh-icon-btn"
                        onClick={() => deletePost(post)}
                        aria-label="Delete post"
                      >
                        <Trash2 size={16}/>
                      </button>
                    )}
                  </div>

                  {post.body && (
                    <p className="sh-post-text">{post.body}</p>
                  )}

                  {post.media_url && (
                    post.media_type === "video"
                      ? (
                        <video
                          className="sh-post-media"
                          src={post.media_url}
                          controls
                          playsInline
                        />
                      )
                      : (
                        <img
                          className="sh-post-media"
                          src={post.media_url}
                          alt="Post"
                          loading="lazy"
                        />
                      )
                  )}

                  <div className="sh-post-actions">
                    <button
                      className={postLiked ? "liked" : ""}
                      onClick={() => toggleLike(post)}
                    >
                      <Heart size={19}/> {likeCount}
                    </button>

                    <span>
                      <MessageCircle size={18}/> {commentList.length}
                    </span>

                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          `${window.location.origin}/?post=${post.id}`
                        );
                        notify("Post link copied.");
                      }}
                    >
                      <Send size={18}/>
                    </button>

                    <button
                      className="sh-save"
                      onClick={() => toggleSave(post)}
                    >
                      <Bookmark
                        size={18}
                        fill={saved.includes(post.id) ? "currentColor" : "none"}
                      />
                    </button>
                  </div>

                  <div className="sh-like-line">
                    <b>{likeCount} likes</b>
                  </div>

                  {commentList.slice(-3).map(comment => (
                    <p className="sh-comment-line" key={comment.id}>
                      <b>
                        {comment.profiles?.display_name || "Member"}
                      </b>
                      {" "}{comment.body}
                    </p>
                  ))}

                  <form
                    className="sh-comment"
                    onSubmit={event => addComment(event, post)}
                  >
                    <input
                      value={comments[post.id] || ""}
                      onChange={e => setComments(old => ({
                        ...old,
                        [post.id]: e.target.value
                      }))}
                      placeholder="Add a comment..."
                    />
                    <button disabled={!(comments[post.id] || "").trim()}>
                      Post
                    </button>
                  </form>
                </article>
              );
            })}

            {!visiblePosts.length && (
              <div className="sh-empty">
                <Compass size={26}/>
                <b>Nothing here yet</b>
                <span>Follow people or share the first post.</span>
              </div>
            )}
          </main>

          <aside className="sh-aside">
            <section className="sh-mini-profile">
              <div className="sh-avatar large">
                {getInitial(username)}
              </div>

              <div>
                <b>{username}</b>
                <small>{session?.user?.email}</small>
              </div>

              <button onClick={() => setPage("profile")}>
                View
              </button>
            </section>

            <div className="sh-suggest-head">
              <b>People to discover</b>
              <button onClick={loadData}>Refresh</button>
            </div>

            {suggestions.map(person => (
              <div className="sh-person" key={person.id}>
                <div className="sh-avatar">
                  {getInitial(person.display_name)}
                </div>

                <div>
                  <b>{person.display_name || "Member"}</b>
                  <small>Suggested for you</small>
                </div>

                <button onClick={() => toggleFollow(person)}>
                  <UserPlus size={14}/> Follow
                </button>
              </div>
            ))}

            <p className="sh-footnote">
              Be kind. Think critically. Share responsibly.
              <br/>UNBLINDED · Bangladesh
            </p>
          </aside>
        </div>
      )}

      {activeStory && (
        <div
          className="sh-story-modal"
          onClick={() => setActiveStory(null)}
        >
          <button aria-label="Close story">
            <X/>
          </button>

          {activeStory.media_type === "video"
            ? (
              <video
                src={activeStory.media_url}
                controls
                autoPlay
              />
            )
            : (
              <img
                src={activeStory.media_url}
                alt="Story"
              />
            )}

          <b>{activeStory.profiles?.display_name || "Story"}</b>
        </div>
      )}
    </section>
  );
}
