import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Search, Send, Plus, MoreHorizontal,
  Smile, Reply, Pencil, Trash2, ShieldBan, Flag,
  CheckCheck, MessageCircle, X, Pin, Archive
} from "lucide-react";
import "./messages.css";

const EMOJIS = ["❤️", "😂", "🔥", "👍", "😮", "😢"];

export default function Messages({ supabase, onClose }) {
  const [user, setUser] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [people, setPeople] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [reply, setReply] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [menu, setMenu] = useState(null);
  const bottomRef = useRef(null);

  const notify = message => window.alert(message);

  const loadUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      setLoading(false);
      return;
    }
    setUser(data.user);
  }, [supabase]);

  const loadInbox = useCallback(async () => {
    if (!user) return;

    const { data: memberships, error } = await supabase
      .from("conversation_members")
      .select("conversation_id,last_read_at,pinned_at,archived_at")
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const ids = (memberships || []).map(m => m.conversation_id);
    if (!ids.length) {
      setInbox([]);
      setLoading(false);
      return;
    }

    const [{ data: members }, { data: latest }] = await Promise.all([
      supabase.from("conversation_members")
        .select("conversation_id,user_id")
        .in("conversation_id", ids),
      supabase.from("direct_messages")
        .select("id,conversation_id,sender_id,body,created_at,deleted_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .limit(200)
    ]);

    const otherIds = [...new Set(
      (members || [])
        .filter(m => m.user_id !== user.id)
        .map(m => m.user_id)
    )];

    const { data: profiles } = otherIds.length
      ? await supabase.from("profiles")
          .select("id,display_name,avatar_url")
          .in("id", otherIds)
      : { data: [] };

    const profileMap = Object.fromEntries(
      (profiles || []).map(p => [p.id, p])
    );

    const result = ids.map(id => {
      const membership = memberships.find(m => m.conversation_id === id);
      const other = (members || []).find(
        m => m.conversation_id === id && m.user_id !== user.id
      );
      const last = (latest || []).find(m => m.conversation_id === id);
      const unread = (latest || []).filter(m =>
        m.conversation_id === id &&
        m.sender_id !== user.id &&
        (!membership.last_read_at ||
          new Date(m.created_at) > new Date(membership.last_read_at))
      ).length;

      return {
        id,
        otherId: other?.user_id,
        profile: profileMap[other?.user_id] || {},
        last,
        unread,
        pinned: membership?.pinned_at,
        archived: membership?.archived_at
      };
    });

    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.last?.created_at || 0) -
        new Date(a.last?.created_at || 0);
    });

    setInbox(result);
    setLoading(false);
  }, [supabase, user]);

  const loadMessages = useCallback(async conversationId => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from("direct_messages")
      .select("id,conversation_id,sender_id,body,reply_to,edited_at,deleted_at,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(300);

    if (error) {
      console.error(error);
      return;
    }

    const ids = (data || []).map(m => m.id);
    const { data: reactions } = ids.length
      ? await supabase.from("message_reactions")
          .select("id,message_id,user_id,emoji")
          .in("message_id", ids)
      : { data: [] };

    setMessages((data || []).map(m => ({
      ...m,
      reactions: (reactions || []).filter(r => r.message_id === m.id)
    })));
  }, [supabase]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (user) loadInbox();
  }, [user, loadInbox]);

  useEffect(() => {
    if (!selected || !user) return;

    loadMessages(selected.id);

    supabase.from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", selected.id)
      .eq("user_id", user.id)
      .then(() => loadInbox());

    const channel = supabase
      .channel("dm-" + selected.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "direct_messages",
        filter: "conversation_id=eq." + selected.id
      }, () => {
        loadMessages(selected.id);
        loadInbox();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "message_reactions"
      }, () => loadMessages(selected.id))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected?.id, user?.id, supabase, loadMessages, loadInbox]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function searchPeople(value) {
    setSearch(value);
    if (value.trim().length < 2) {
      setPeople([]);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url")
      .ilike("display_name", "%" + value.trim() + "%")
      .neq("id", user.id)
      .limit(15);

    if (error) {
      console.error(error);
      return;
    }
    setPeople(data || []);
  }

  async function startConversation(person) {
    const { data, error } = await supabase.rpc(
      "start_direct_conversation",
      { target_user: person.id }
    );

    if (error) {
      notify(error.message);
      return;
    }

    setSelected({
      id: data,
      otherId: person.id,
      profile: person,
      unread: 0
    });
    setShowSearch(false);
    setSearch("");
    setPeople([]);
    await loadInbox();
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !selected || sending) return;

    setSending(true);
    const { error } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: selected.id,
        sender_id: user.id,
        body: text.trim(),
        reply_to: reply?.id || null
      });
    setSending(false);

    if (error) {
      notify(error.message);
      return;
    }

    setText("");
    setReply(null);
    await loadMessages(selected.id);
    await loadInbox();
  }

  async function toggleReaction(message, emoji) {
    const existing = message.reactions?.find(
      r => r.user_id === user.id && r.emoji === emoji
    );

    const result = existing
      ? await supabase.from("message_reactions")
          .delete().eq("id", existing.id)
      : await supabase.from("message_reactions").insert({
          message_id: message.id,
          user_id: user.id,
          emoji
        });

    if (result.error) notify(result.error.message);
    else loadMessages(selected.id);
  }

  async function editMessage(message) {
    if (message.sender_id !== user.id || message.deleted_at) return;
    const next = window.prompt("Edit your message", message.body);
    if (!next?.trim() || next === message.body) return;

    const { error } = await supabase.from("direct_messages")
      .update({
        body: next.trim(),
        edited_at: new Date().toISOString()
      })
      .eq("id", message.id);

    if (error) notify(error.message);
    else loadMessages(selected.id);
  }

  async function deleteMessage(message) {
    if (message.sender_id !== user.id) return;
    if (!window.confirm("Delete this message?")) return;

    const { error } = await supabase.from("direct_messages")
      .update({
        body: "This message was deleted",
        deleted_at: new Date().toISOString()
      })
      .eq("id", message.id);

    if (error) notify(error.message);
    else loadMessages(selected.id);
  }

  async function blockUser() {
    if (!selected?.otherId) return;
    if (!window.confirm("Block this member? They won't be able to message you.")) return;

    const { error } = await supabase.from("user_blocks").insert({
      blocker_id: user.id,
      blocked_id: selected.otherId
    });

    if (error) notify(error.message);
    else {
      setSelected(null);
      await loadInbox();
      notify("Member blocked.");
    }
  }

  async function reportUser() {
    if (!selected?.otherId) return;
    const reason = window.prompt("Why are you reporting this member?");
    if (!reason?.trim()) return;

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: "user",
      target_id: selected.otherId,
      reason: reason.trim()
    });

    if (error) notify(error.message);
    else notify("Report submitted.");
  }

  async function updateInboxSetting(field, value) {
    const { error } = await supabase.from("conversation_members")
      .update({ [field]: value })
      .eq("conversation_id", selected.id)
      .eq("user_id", user.id);

    if (error) notify(error.message);
    else {
      await loadInbox();
      setMenu(null);
    }
  }

  function formatTime(value) {
    if (!value) return "";
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  if (!user) {
    return (
      <div className="dm-shell">
        <div className="dm-empty">
          <MessageCircle size={34} />
          <h2>Sign in to use messages</h2>
          <p>Your private conversations will appear here.</p>
          <button onClick={onClose}>Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-shell">
      <aside className={"dm-sidebar " + (selected ? "dm-sidebar-hidden" : "")}>
        <div className="dm-side-head">
          <div>
            <span className="dm-kicker">UNBLINDED PRIVATE</span>
            <h1>Messages</h1>
          </div>
          <button className="dm-icon" onClick={onClose} title="Close">
            <X size={19} />
          </button>
        </div>

        <button className="dm-new" onClick={() => setShowSearch(!showSearch)}>
          <Plus size={18} /> New message
        </button>

        {showSearch && (
          <div className="dm-search-panel">
            <div className="dm-search">
              <Search size={17} />
              <input
                autoFocus
                placeholder="Find a member..."
                value={search}
                onChange={e => searchPeople(e.target.value)}
              />
              <button onClick={() => {
                setShowSearch(false);
                setSearch("");
                setPeople([]);
              }}>
                <X size={16} />
              </button>
            </div>

            {people.map(person => (
              <button
                className="dm-person"
                key={person.id}
                onClick={() => startConversation(person)}
              >
                <div className="dm-avatar">
                  {person.avatar_url
                    ? <img src={person.avatar_url} alt="" />
                    : (person.display_name || "?").slice(0, 1)}
                </div>
                <span>{person.display_name || "Member"}</span>
              </button>
            ))}

            {search.length >= 2 && !people.length && (
              <p className="dm-hint">No matching members found.</p>
            )}
          </div>
        )}

        <div className="dm-inbox-label">YOUR INBOX</div>

        <div className="dm-inbox">
          {loading && <p className="dm-hint">Loading conversations…</p>}

          {!loading && !inbox.length && (
            <div className="dm-empty-small">
              <MessageCircle size={28} />
              <p>No conversations yet.</p>
              <span>Start a private conversation with a member.</span>
            </div>
          )}

          {inbox.filter(c => !c.archived).map(conversation => (
            <button
              key={conversation.id}
              className={"dm-thread " +
                (selected?.id === conversation.id ? "active" : "")}
              onClick={() => setSelected(conversation)}
            >
              <div className="dm-avatar">
                {conversation.profile.avatar_url
                  ? <img src={conversation.profile.avatar_url} alt="" />
                  : (conversation.profile.display_name || "?").slice(0, 1)}
              </div>

              <div className="dm-thread-copy">
                <div className="dm-thread-top">
                  <b>{conversation.profile.display_name || "Member"}</b>
                  <small>{formatTime(conversation.last?.created_at)}</small>
                </div>

                <div className="dm-thread-bottom">
                  <span>
                    {conversation.last?.deleted_at
                      ? "Message deleted"
                      : conversation.last?.body || "Start a conversation"}
                  </span>
                  {conversation.unread > 0 && (
                    <i>{conversation.unread > 99 ? "99+" : conversation.unread}</i>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="dm-side-foot">
          <span>Private conversations</span>
          <span>·</span>
          <span>Respect each other</span>
        </div>
      </aside>

      <main className={"dm-chat " + (!selected ? "dm-chat-hidden" : "")}>
        {!selected ? (
          <div className="dm-welcome">
            <div className="dm-welcome-icon">
              <MessageCircle size={35} />
            </div>
            <span className="dm-kicker">A SPACE OF YOUR OWN</span>
            <h2>Good conversations<br />start with a message.</h2>
            <p>Choose a conversation or find someone new to talk to.</p>
            <button className="dm-new" onClick={() => setShowSearch(true)}>
              <Plus size={18} /> New message
            </button>
          </div>
        ) : (
          <>
            <header className="dm-chat-head">
              <button className="dm-back" onClick={() => setSelected(null)}>
                <ArrowLeft size={19} />
              </button>

              <div className="dm-avatar">
                {selected.profile.avatar_url
                  ? <img src={selected.profile.avatar_url} alt="" />
                  : (selected.profile.display_name || "?").slice(0, 1)}
              </div>

              <div className="dm-chat-person">
                <b>{selected.profile.display_name || "Member"}</b>
                <small>Private conversation</small>
              </div>

              <div className="dm-chat-actions">
                <button
                  className="dm-icon"
                  onClick={() => setMenu(menu === "open" ? null : "open")}
                >
                  <MoreHorizontal size={21} />
                </button>

                {menu === "open" && (
                  <div className="dm-menu">
                    <button onClick={() => updateInboxSetting(
                      "pinned_at",
                      inbox.find(c => c.id === selected.id)?.pinned
                        ? null
                        : new Date().toISOString()
                    )}>
                      <Pin size={15} /> Pin / unpin
                    </button>
                    <button onClick={() => updateInboxSetting(
                      "archived_at", new Date().toISOString()
                    )}>
                      <Archive size={15} /> Archive conversation
                    </button>
                    <button onClick={blockUser}>
                      <ShieldBan size={15} /> Block member
                    </button>
                    <button onClick={reportUser}>
                      <Flag size={15} /> Report member
                    </button>
                  </div>
                )}
              </div>
            </header>

            <div className="dm-messages">
              {!messages.length && (
                <div className="dm-first">
                  <div className="dm-avatar large">
                    {selected.profile.avatar_url
                      ? <img src={selected.profile.avatar_url} alt="" />
                      : (selected.profile.display_name || "?").slice(0, 1)}
                  </div>
                  <h3>{selected.profile.display_name || "Member"}</h3>
                  <p>This is the beginning of your private conversation.</p>
                </div>
              )}

              {messages.map(message => {
                const mine = message.sender_id === user.id;
                const parent = messages.find(m => m.id === message.reply_to);

                return (
                  <div
                    key={message.id}
                    className={"dm-message-row " + (mine ? "mine" : "")}
                  >
                    <div className="dm-message-wrap">
                      {parent && (
                        <div className="dm-replied">↳ {parent.body}</div>
                      )}

                      <div className={"dm-bubble " + (mine ? "mine" : "")}>
                        {message.deleted_at
                          ? <i>This message was deleted</i>
                          : message.body}
                      </div>

                      <div className="dm-message-meta">
                        <span>{formatTime(message.created_at)}</span>
                        {message.edited_at && <span> · edited</span>}
                        {mine && <CheckCheck size={13} />}

                        <button title="Reply" onClick={() => setReply(message)}>
                          <Reply size={14} />
                        </button>

                        {!message.deleted_at && (
                          <button
                            title="React"
                            onClick={() => setMenu(
                              menu === message.id ? null : message.id
                            )}
                          >
                            <Smile size={14} />
                          </button>
                        )}

                        {mine && !message.deleted_at && (
                          <>
                            <button title="Edit" onClick={() => editMessage(message)}>
                              <Pencil size={13} />
                            </button>
                            <button title="Delete" onClick={() => deleteMessage(message)}>
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>

                      {menu === message.id && (
                        <div className="dm-reaction-picker">
                          {EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => {
                                toggleReaction(message, emoji);
                                setMenu(null);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      {!!message.reactions?.length && (
                        <div className="dm-reactions">
                          {EMOJIS.filter(emoji =>
                            message.reactions.some(r => r.emoji === emoji)
                          ).map(emoji => (
                            <button
                              key={emoji}
                              className={message.reactions.some(r =>
                                r.user_id === user.id && r.emoji === emoji
                              ) ? "selected" : ""}
                              onClick={() => toggleReaction(message, emoji)}
                            >
                              {emoji}
                              <span>
                                {message.reactions.filter(r => r.emoji === emoji).length}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div ref={bottomRef} />
            </div>

            {reply && (
              <div className="dm-replying">
                <div>
                  <small>
                    Replying to {reply.sender_id === user.id
                      ? "yourself"
                      : selected.profile.display_name}
                  </small>
                  <p>{reply.body}</p>
                </div>
                <button onClick={() => setReply(null)} title="Cancel reply">
                  <X size={17} />
                </button>
              </div>
            )}

            <form className="dm-composer" onSubmit={sendMessage}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Write a message..."
                aria-label="Write a message"
                maxLength={5000}
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                title="Send message"
              >
                <Send size={18} />
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
