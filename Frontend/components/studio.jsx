"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

function uid(prefix) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneDoc(value) {
  return JSON.parse(JSON.stringify(value));
}

const FONT_LADDER = [11, 12, 13, 14, 15, 16, 18, 20, 24, 30, 36, 48, 60];

const VOICE_LANGS = [
  ["hi-IN", "हिन्दी (India)"],
  ["en-IN", "English (India)"],
  ["en-US", "English (US)"],
  ["mr-IN", "मराठी"],
  ["gu-IN", "ગુજરાતી"],
  ["bn-IN", "বাংলা"],
  ["ta-IN", "தமிழ்"],
  ["te-IN", "తెలుగు"],
  ["pa-IN", "ਪੰਜਾਬੀ"],
];

const DEFAULT_FORM_VALUES = {
  tenantName: "",
  tenantRelation: "पत्नी",
  tenantFamilyName: "",
  tenantAge: "",
  tenantAddress: "",
  landlordName: "",
  landlordRelation: "पुत्र",
  landlordFamilyName: "",
  landlordAge: "",
  landlordAddress: "",
  propertyAddress: "",
  rentAmount: "",
  agreementDate: "",
  duration: "",
  witnessOne: "",
  witnessTwo: "",
};

const RENT_AGREEMENT_DEFAULT_FORM_VALUES = {
  tenantName: "श्रीमती मीना झालानी",
  tenantRelation: "पत्नी",
  tenantFamilyName: "श्री महेश झालानी",
  tenantAge: "",
  tenantAddress: "प्लॉट नं–56, गोपाल बाड़ी, अजमेर रोड, जयपुर, (राज.)–302001",
  landlordName: "श्री कृष्ण कुमार झालानी",
  landlordRelation: "पुत्र",
  landlordFamilyName: "श्री महेश झालानी",
  landlordAge: "35",
  landlordAddress: "प्लॉट नं–56, गोपाल बाड़ी, अजमेर रोड, जयपुर, (राज.)–302001",
  propertyAddress:
    "प्लॉट नम्बर 21, श्री गणेश विहार-“बी”, श्याम नगर के पास, अजमेर रोड, जयपुर, राजस्थान–302019",
  rentAmount: "2,000/-",
  agreementDate: "15-05-2026",
  duration: "11 माह",
  witnessOne: "",
  witnessTwo: "",
};

export default function Studio({
  initialTemplates,
  backendAvailable: initialBackendAvailable,
}) {
  const [templates] = useState(initialTemplates);
  const [drafts, setDrafts] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Ready");
  const [voiceLang, setVoiceLang] = useState("hi-IN");
  const [voiceActive, setVoiceActive] = useState(false);
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);
  const titleRef = useRef(null);
  const pageRefs = useRef([]);
  const voiceRecognitionRef = useRef(null);
  const savedRangeRef = useRef(null);
  const dictationRangeRef = useRef(null);
  const dictationCaretRef = useRef(null);
  const interimNodeRef = useRef(null);
  const focusedPageIndexRef = useRef(0);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const voiceActiveRef = useRef(false);
  const voiceLangRef = useRef("hi-IN");
  const activeDraftRef = useRef(null);
  const isApplyingHistoryRef = useRef(false);
  const voiceStartingRef = useRef(false);
  const [documents, setDocuments] = useState([]);

  const [backendAvailable, setBackendAvailable] = useState(
    initialBackendAvailable,
  );

  // create document

  async function saveAggrement() {
    try {
      const isUpdate = activeDraftId && !activeDraftId.startsWith("draft_");

      const url = isUpdate
        ? `https://law-client.onrender.com/api/documents/${activeDraftId}`
        : "https://law-client.onrender.com/api/documents";

      const method = isUpdate ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateKey: activeDraft?.templateKey,
          templateName: activeDraft?.name,
          title: activeDraft?.title,
          pages: activeDraft?.pages,
          formValues,
          status: "draft",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Save failed");
      }

      const savedDoc = data.data;

      // 🔥 UPDATE UI STATE IMMEDIATELY
      setDocuments((prev) => {
        const exists = prev.find((d) => d._id === savedDoc._id);

        if (exists) {
          return prev.map((d) => (d._id === savedDoc._id ? savedDoc : d));
        }

        return [savedDoc, ...prev];
      });

      alert(isUpdate ? "Agreement updated" : "Agreement created");

      setActiveDraftId(savedDoc._id);

      goHome();
    } catch (error) {
      console.error("Save Error:", error);
    }
  }

  // get all document in home

  async function loadDocuments() {
    try {
      const res = await fetch("https://law-client.onrender.com/api/documents");

      if (!res.ok) {
        setBackendAvailable(false);
        setDocuments([]);
        return;
      }

      const result = await res.json();

      setBackendAvailable(true);
      setDocuments(result.data || []);
    } catch (error) {
      setBackendAvailable(false);
      setDocuments([]);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  // get document by id

  async function openDocument(doc) {
    try {
      const res = await fetch(
        `https://law-client.onrender.com/api/documents/${doc._id}`,
      );

      const result = await res.json();

      const document = result.data;

      const draft = {
        id: document._id,
        title: document.title,
        pages: document.pages,
        templateKey: document.templateKey,
        name: document.templateName,
        formValues: document.formValues,
      };

      setDrafts((prev) => [...prev, draft]);

      setActiveDraftId(draft.id);

      setFormValues(document.formValues || {});
    } catch (error) {
      console.error(error);
    }
  }

  // agrement delete function

  async function deleteDocument(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this agreement?",
    );

    if (!confirmed) return;

    try {
      await fetch(`https://law-client.onrender.com/api/documents/${id}`, {
        method: "DELETE",
      });

      setDocuments((prev) => prev.filter((doc) => doc._id !== id));

      setStatus("Document deleted");
    } catch (error) {
      console.error(error);
    }
  }

  const activeDraft = useMemo(
    () => drafts.find((d) => d.id === activeDraftId) || null,
    [drafts, activeDraftId],
  );

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((template) => {
      const hay = [template.name, template.description, template.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [templates, query]);

  const recentDrafts = drafts.slice(0, 6);
  const isRentAgreementDraft =
    activeDraft?.templateId === "rent-agreement-hindi";

  useEffect(() => {
    voiceActiveRef.current = voiceActive;
  }, [voiceActive]);

  useEffect(() => {
    voiceLangRef.current = voiceLang;
    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.lang = voiceLang;
    }
  }, [voiceLang]);

  useEffect(() => {
    activeDraftRef.current = activeDraft;
  }, [activeDraft]);

  useEffect(() => {
    if (activeDraft && titleRef.current) {
      titleRef.current.value = activeDraft.name;
    }
  }, [activeDraft]);

  useLayoutEffect(() => {
    if (!activeDraft) return;

    activeDraft.pages.forEach((page, pageIndex) => {
      const editable = pageRefs.current[pageIndex];
      if (!editable || editable.innerHTML === page) return;
      editable.innerHTML = page;

      const activeElement = document.activeElement;
      const caretSnapshot = dictationCaretRef.current;
      const shouldRestoreCaret =
        activeElement === editable && caretSnapshot?.pageIndex === pageIndex;
      if (!shouldRestoreCaret) return;

      const selection = window.getSelection();
      if (!selection) return;
      const restored = createRangeFromTextOffset(
        editable,
        caretSnapshot.offset,
      );
      selection.removeAllRanges();
      selection.addRange(restored);
      dictationRangeRef.current = restored.cloneRange();
    });

    pageRefs.current.length = activeDraft.pages.length;
  }, [activeDraft]);

  useEffect(() => {
    if (activeDraft?.formValues) {
      const seed =
        activeDraft.templateId === "rent-agreement-hindi"
          ? RENT_AGREEMENT_DEFAULT_FORM_VALUES
          : DEFAULT_FORM_VALUES;
      setFormValues({ ...seed, ...activeDraft.formValues });
      return;
    }
    setFormValues(
      activeDraft?.templateId === "rent-agreement-hindi"
        ? RENT_AGREEMENT_DEFAULT_FORM_VALUES
        : DEFAULT_FORM_VALUES,
    );
  }, [activeDraftId]);

  useEffect(() => {
    const rememberSelection = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      const editable = pageRefs.current.find(
        (el) => el && el.contains(range.startContainer),
      );
      if (!editable) return;
      dictationRangeRef.current = range.cloneRange();
      const pageIndex = pageRefs.current.findIndex((el) => el === editable);
      if (pageIndex >= 0) {
        focusedPageIndexRef.current = pageIndex;
        dictationCaretRef.current = {
          pageIndex,
          offset: getRangeTextOffset(editable, range),
        };
      }
    };

    document.addEventListener("selectionchange", rememberSelection);
    return () =>
      document.removeEventListener("selectionchange", rememberSelection);
  }, []);

  function buildVoiceRecognition() {
    const speechWindow = window;
    const SR =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SR) return null;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = voiceLangRef.current;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }

      if (interimText)
        renderVoiceTranscript(
          polishDictation(interimText, recognition.lang, true),
          false,
        );
      else clearVoiceInterim();
      if (finalText)
        renderVoiceTranscript(
          polishDictation(finalText, recognition.lang, false),
          true,
        );
    };

    recognition.onerror = (event) => {
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        stopVoice();
        setStatus("Microphone blocked");
      } else if (event.error === "audio-capture") {
        stopVoice();
        setStatus("No microphone detected");
      } else if (event.error === "network") {
        setStatus("Voice network error");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setStatus(`Voice error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (voiceActiveRef.current) {
        window.setTimeout(() => {
          if (!voiceRecognitionRef.current || !voiceActiveRef.current) return;
          try {
            voiceRecognitionRef.current.start();
          } catch {
            /* ignore */
          }
        }, 80);
      }
    };

    return recognition;
  }

  useEffect(() => {
    const recognition = buildVoiceRecognition();
    if (!recognition) return;
    voiceRecognitionRef.current = recognition;
    return () => {
      voiceActiveRef.current = false;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      voiceRecognitionRef.current = null;
    };
  }, []);

  function createDraftFromTemplate(template) {
    const seededFormValues =
      template.id === "rent-agreement-hindi"
        ? RENT_AGREEMENT_DEFAULT_FORM_VALUES
        : DEFAULT_FORM_VALUES;

    const draft = {
      ...cloneDoc(template),
      id: uid("draft"),
      templateId: template.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pages: cloneDoc(template.pages),
      formValues: cloneDoc(seededFormValues),
    };

    setDrafts((current) => [draft, ...current]);
    setActiveDraftId(draft.id);
    setStatus(`Created draft from ${template.name}`);
  }

  function snapshotDraft() {
    if (!activeDraft) return;
    undoStackRef.current.push(cloneDoc(activeDraft));
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPersonBlock(name, relation, familyName, age, address) {
    const parts = [
      name.trim(),
      relation.trim() && familyName.trim()
        ? `${relation.trim()} ${familyName.trim()}`
        : familyName.trim(),
      age.trim() ? `उम्र ${age.trim()} वर्ष` : "",
      address.trim() ? `निवासी– ${address.trim()}` : "",
    ].filter(Boolean);

    return parts.join(", ");
  }

  function buildRentAgreementPages(basePages, values) {
    const tenantBlock = formatPersonBlock(
      values.tenantName,
      values.tenantRelation,
      values.tenantFamilyName,
      values.tenantAge,
      values.tenantAddress,
    );
    const landlordBlock = formatPersonBlock(
      values.landlordName,
      values.landlordRelation,
      values.landlordFamilyName,
      values.landlordAge,
      values.landlordAddress,
    );
    const agreementDate = values.agreementDate.trim() || "15-05-2026";
    const rentAmount = values.rentAmount.trim() || "2,000/-";
    const duration = values.duration.trim() || "11 माह";
    const propertyAddress =
      values.propertyAddress.trim() ||
      "प्लॉट नम्बर 21, श्री गणेश विहार-“बी”, श्याम नगर के पास, अजमेर रोड, जयपुर, राजस्थान–302019";
    const witnessOne =
      values.witnessOne.trim() ||
      values.tenantName.trim() ||
      "________________";
    const witnessTwo =
      values.witnessTwo.trim() ||
      values.landlordName.trim() ||
      "________________";

    return basePages.map((page) => {
      let next = page;
      next = next.replace(
        /श्रीमती मीना झालानी पत्नी श्री महेश झालानी, उम्र .. वर्ष, जाति महाजन निवासी– प्लॉट नं–56, गोपाल बाड़ी, अजमेर रोड, जयपुर, \(राज\.\)–302001/g,
        escapeHtml(tenantBlock) || "________________",
      );
      next = next.replace(
        /श्री कृष्ण कुमार झालानी पुत्र श्री महेश झालानी, आयु–35 वर्ष, जाति–महाजन निवासी– प्लॉट नं–56, गोपाल बाड़ी, अजमेर रोड, जयपुर, \(राज\.\)–302001/g,
        escapeHtml(landlordBlock) || "________________",
      );
      next = next.replace(
        /प्लॉट नम्बर 21, श्री गणेश विहार-“बी”, श्याम नगर के पास, अजमेर रोड, जयपुर, राजस्थान–302019/g,
        escapeHtml(propertyAddress),
      );
      next = next.replace(/15-05-2026/g, escapeHtml(agreementDate));
      next = next.replace(/2,000\/-/g, escapeHtml(rentAmount));
      next = next.replace(/11 माह/g, escapeHtml(duration));
      next = next.replace(
        /\(मीना झालानी\)/g,
        `(${escapeHtml(values.tenantName || "मीना झालानी")})`,
      );
      next = next.replace(
        /\(कृष्ण कुमार झालानी\)/g,
        `(${escapeHtml(values.landlordName || "कृष्ण कुमार झालानी")})`,
      );
      next = next.replace(
        /1\.  __________________________________________________/g,
        `1.  ${escapeHtml(witnessOne)}`,
      );
      next = next.replace(
        /2\.  __________________________________________________/g,
        `2.  ${escapeHtml(witnessTwo)}`,
      );
      next = next.replace(
        /श्रीमती मीना झालानी/g,
        escapeHtml(values.tenantName || "श्रीमती मीना झालानी"),
      );
      next = next.replace(
        /श्री कृष्ण कुमार झालानी/g,
        escapeHtml(values.landlordName || "श्री कृष्ण कुमार झालानी"),
      );
      return next;
    });
  }

  function updateFormValue(field, value) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function applyFormToDraft() {
    if (!activeDraft) {
      setStatus("Open a draft first");
      return;
    }

    const filledValues = {
      ...(activeDraft.templateId === "rent-agreement-hindi"
        ? RENT_AGREEMENT_DEFAULT_FORM_VALUES
        : DEFAULT_FORM_VALUES),
      ...formValues,
    };
    snapshotDraft();

    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== activeDraft.id) return draft;
        const pages =
          draft.templateId === "rent-agreement-hindi"
            ? buildRentAgreementPages(draft.pages, filledValues)
            : draft.pages;

        const title = filledValues.tenantName.trim()
          ? `${filledValues.tenantName.trim()} · ${draft.name}`
          : draft.name;

        return {
          ...draft,
          name: title,
          pages,
          formValues: filledValues,
          updatedAt: Date.now(),
        };
      }),
    );

    setStatus("Form data applied to draft");
  }

  function restoreDraft(snapshot) {
    isApplyingHistoryRef.current = true;
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === snapshot.id ? cloneDoc(snapshot) : draft,
      ),
    );
    setActiveDraftId(snapshot.id);
    window.setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
    setStatus("History restored");
  }

  function undoEdit() {
    if (!activeDraft) return;
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    const current = cloneDoc(activeDraft);
    redoStackRef.current.push(current);
    restoreDraft(prev);
    setStatus("Undone");
  }

  function redoEdit() {
    if (!activeDraft) return;
    const next = redoStackRef.current.pop();
    if (!next) return;
    const current = cloneDoc(activeDraft);
    undoStackRef.current.push(current);
    restoreDraft(next);
    setStatus("Redone");
  }

  function saveActiveDraft() {
    if (!activeDraft) return;
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === activeDraft.id
          ? { ...draft, updatedAt: Date.now() }
          : draft,
      ),
    );
    setStatus("Saved in memory for this session");
  }

  function deleteDraft(id) {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
    if (activeDraftId === id) setActiveDraftId(null);
    setStatus("Draft deleted");
  }

  function updateDraftTitle(nextTitle) {
    if (!activeDraft) return;
    if (!isApplyingHistoryRef.current) snapshotDraft();
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === activeDraft.id
          ? { ...draft, name: nextTitle, updatedAt: Date.now() }
          : draft,
      ),
    );
  }

  function updatePageHtml(pageIndex, html) {
    if (!activeDraft) return;
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== activeDraft.id) return draft;
        const pages = [...draft.pages];
        pages[pageIndex] = html;
        return { ...draft, pages, updatedAt: Date.now() };
      }),
    );
  }

  function capturePageEdit(pageIndex) {
    if (!activeDraft || isApplyingHistoryRef.current) return;
    snapshotDraft();
    const current = pageRefs.current[pageIndex]?.innerHTML;
    if (typeof current === "string") {
      setDrafts((state) =>
        state.map((draft) =>
          draft.id === activeDraft.id
            ? {
                ...draft,
                pages: draft.pages.map((page, idx) =>
                  idx === pageIndex ? current : page,
                ),
                updatedAt: Date.now(),
              }
            : draft,
        ),
      );
    }
  }

  function goHome() {
    setActiveDraftId(null);
    setStatus("Browsing templates");
  }

  function setActivePage(pageIndex) {
    pageRefs.current[pageIndex]?.focus();
  }

  function syncActivePage(pageIndex) {
    const editable = pageRefs.current[pageIndex];
    if (!editable || !activeDraft) return;
    const html = editable.innerHTML;
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === activeDraft.id
          ? {
              ...draft,
              pages: draft.pages.map((page, idx) =>
                idx === pageIndex ? html : page,
              ),
              updatedAt: Date.now(),
            }
          : draft,
      ),
    );
  }

  function ensureEditable(pageIndex) {
    if (!activeDraft) return null;
    const editable =
      typeof pageIndex === "number"
        ? pageRefs.current[pageIndex]
        : pageRefs.current.find(Boolean);
    if (!editable) return null;
    editable.focus({ preventScroll: true });
    return editable;
  }

  function rememberEditorRange(pageIndex) {
    const selection = window.getSelection();
    const editable =
      typeof pageIndex === "number"
        ? pageRefs.current[pageIndex]
        : getVoiceEditable();
    if (!editable || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editable.contains(range.startContainer)) return;
    dictationRangeRef.current = range.cloneRange();
    const resolvedPageIndex =
      typeof pageIndex === "number"
        ? pageIndex
        : pageRefs.current.findIndex((el) => el === editable);
    if (resolvedPageIndex >= 0) {
      focusedPageIndexRef.current = resolvedPageIndex;
      dictationCaretRef.current = {
        pageIndex: resolvedPageIndex,
        offset: getRangeTextOffset(editable, range),
      };
    }
  }

  function getRangeTextOffset(editable, range) {
    const probe = range.cloneRange();
    probe.selectNodeContents(editable);
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString().length;
  }

  function createRangeFromTextOffset(editable, offset) {
    const range = document.createRange();
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, offset);
    let current = walker.nextNode();

    while (current) {
      const length = current.textContent?.length || 0;
      if (remaining <= length) {
        range.setStart(current, remaining);
        range.collapse(true);
        return range;
      }
      remaining -= length;
      current = walker.nextNode();
    }

    range.selectNodeContents(editable);
    range.collapse(false);
    return range;
  }

  function getPlaceholderRange(editable) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!editable.contains(range.startContainer)) return null;

    if (!range.collapsed) {
      const selectedText = range.toString();
      if (/^[\s_()]+$/.test(selectedText) && selectedText.includes("_")) {
        return range.cloneRange();
      }
      return null;
    }

    const container = range.startContainer;
    if (container.nodeType !== Node.TEXT_NODE) return null;
    const textNode = container;
    const text = textNode.textContent || "";
    if (!text.includes("_")) return null;

    let start = range.startOffset;
    let end = range.startOffset;

    while (start > 0 && text.charAt(start - 1) === "_") start -= 1;
    while (end < text.length && text.charAt(end) === "_") end += 1;

    if (start === end) return null;

    const placeholderRange = document.createRange();
    placeholderRange.setStart(textNode, start);
    placeholderRange.setEnd(textNode, end);
    return placeholderRange;
  }

  function clearPlaceholderAtSelection(editable) {
    const selection = window.getSelection();
    const placeholderRange = getPlaceholderRange(editable);
    if (!selection || !placeholderRange) return;
    placeholderRange.deleteContents();

    const caret = document.createRange();
    const container = placeholderRange.startContainer;
    const offset = placeholderRange.startOffset;
    caret.setStart(container, offset);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);
  }

  function insertIntoPlaceholder(editable, value) {
    const selection = window.getSelection();
    const placeholderRange = getPlaceholderRange(editable);
    if (!selection || !placeholderRange || !value) return false;

    placeholderRange.deleteContents();
    const strong = document.createElement("strong");
    const textNode = document.createTextNode(value);
    strong.appendChild(textNode);
    const trailingSpace = document.createTextNode("\u00A0");
    placeholderRange.insertNode(trailingSpace);
    placeholderRange.insertNode(strong);

    const caret = document.createRange();
    caret.setStart(textNode, textNode.textContent?.length || 0);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);
    return true;
  }

  function insertHtmlAtCursor(html) {
    const editable = pageRefs.current.find(
      (el) => el && el.contains(document.activeElement),
    );
    if (!editable) {
      setStatus("Click into a page first");
      return;
    }
    snapshotDraft();
    editable.focus({ preventScroll: true });
    document.execCommand("insertHTML", false, html);
    const pageIndex = pageRefs.current.findIndex((el) => el === editable);
    if (pageIndex >= 0) syncActivePage(pageIndex);
  }

  function execFormat(cmd, value) {
    const editable = pageRefs.current.find(
      (el) => el && el.contains(document.activeElement),
    );
    if (!editable) {
      setStatus("Click into a page first");
      return;
    }
    snapshotDraft();
    editable.focus({ preventScroll: true });
    document.execCommand(cmd, false, value);
    const pageIndex = pageRefs.current.findIndex((el) => el === editable);
    if (pageIndex >= 0) syncActivePage(pageIndex);
  }

  function insertTwoColAtCursor() {
    insertHtmlAtCursor(
      '<table class="two-col"><tbody><tr><td>&#8203;</td><td>&#8203;</td></tr></tbody></table><p><br></p>',
    );
  }

  function deletePageAtCursor() {
    if (!activeDraft) return;
    const pageIndex = pageRefs.current.findIndex(
      (el) => el && el.contains(document.activeElement),
    );
    if (pageIndex < 0) {
      setStatus("Click into a page first");
      return;
    }
    if (activeDraft.pages.length <= 1) {
      setStatus("Can't delete the only page");
      return;
    }
    if (!window.confirm(`Delete page ${pageIndex + 1}?`)) return;
    snapshotDraft();
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === activeDraft.id
          ? {
              ...draft,
              pages: draft.pages.filter((_, idx) => idx !== pageIndex),
              updatedAt: Date.now(),
            }
          : draft,
      ),
    );
    setStatus("Page deleted");
  }

  function setFontSize(px) {
    const editable = pageRefs.current.find(
      (el) => el && el.contains(document.activeElement),
    );
    if (!editable) {
      setStatus("Click into a page first");
      return;
    }
    const selection = window.getSelection();
    if (
      !selection?.rangeCount ||
      selection.isCollapsed ||
      !editable.contains(selection.anchorNode)
    ) {
      setStatus("Select some text first");
      return;
    }

    editable.focus({ preventScroll: true });
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const temp = document.createElement("div");
    temp.appendChild(fragment);
    const selectedHTML = temp.innerHTML;
    if (!selectedHTML) return;

    snapshotDraft();

    const wrapped = `<span style="font-size:${px}px">${selectedHTML}</span>`;
    let ok = false;
    try {
      ok = document.execCommand("insertHTML", false, wrapped);
    } catch {
      ok = false;
    }
    if (!ok) {
      const span = document.createElement("span");
      span.style.fontSize = `${px}px`;
      try {
        range.surroundContents(span);
      } catch {
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
      }
    }

    const pageIndex = pageRefs.current.findIndex((el) => el === editable);
    if (pageIndex >= 0) syncActivePage(pageIndex);
  }

  function currentSelectionFontSize() {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    let node = selection.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (!node) return null;
    return parseInt(window.getComputedStyle(node).fontSize, 10) || null;
  }

  function stepFontSize(delta) {
    const current = currentSelectionFontSize() ?? 15;
    let index = FONT_LADDER.findIndex((size) => size >= current);
    if (index === -1) index = FONT_LADDER.length - 1;
    const next =
      FONT_LADDER[Math.max(0, Math.min(FONT_LADDER.length - 1, index + delta))];
    setFontSize(next);
  }

  async function ensureVoicePermission() {
    if (!navigator.mediaDevices?.getUserMedia) return true;
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch {
      return false;
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  async function startVoice() {
    if (voiceStartingRef.current) return;
    voiceStartingRef.current = true;

    let recognition = voiceRecognitionRef.current;
    if (!recognition) {
      recognition = buildVoiceRecognition();
      voiceRecognitionRef.current = recognition;
    }
    if (!recognition) {
      voiceStartingRef.current = false;
      setStatus("Voice not supported in this browser");
      return;
    }
    const editable = getVoiceEditable();
    if (!editable) {
      voiceStartingRef.current = false;
      setStatus("Click into a page first");
      return;
    }

    const hasPermission = await ensureVoicePermission();
    if (!hasPermission) {
      voiceStartingRef.current = false;
      setStatus("Allow microphone access and try again");
      return;
    }

    editable.focus({ preventScroll: true });
    ensureVoiceRange();
    voiceActiveRef.current = true;
    setVoiceActive(true);

    recognition.lang = voiceLang;
    try {
      recognition.start();
      setStatus("Listening live...");
    } catch {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        try {
          recognition.start();
          setStatus("Listening live...");
        } catch {
          setStatus("Microphone could not start");
        }
      }, 200);
    }
    window.setTimeout(() => {
      voiceStartingRef.current = false;
    }, 250);
  }

  function stopVoice() {
    voiceActiveRef.current = false;
    setVoiceActive(false);
    clearVoiceInterim(true);
    const recognition = voiceRecognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    }
    setStatus("Voice stopped");
  }

  function toggleVoice() {
    if (voiceActive) stopVoice();
    else void startVoice();
  }

  function getVoiceEditable() {
    const selection = window.getSelection();
    const current = pageRefs.current.find(
      (el) => el && selection?.rangeCount && el.contains(selection.anchorNode),
    );
    if (current) return current;
    return (
      pageRefs.current[focusedPageIndexRef.current] ||
      pageRefs.current.find(Boolean) ||
      null
    );
  }

  function getTextPrefix(range) {
    if (
      range.startContainer.nodeType === Node.TEXT_NODE &&
      range.startOffset > 0
    ) {
      return (
        range.startContainer.textContent?.charAt(range.startOffset - 1) || ""
      );
    }
    if (
      range.startContainer.nodeType === Node.ELEMENT_NODE &&
      range.startOffset > 0
    ) {
      const prev = range.startContainer.childNodes[range.startOffset - 1];
      return (prev?.textContent || "").slice(-1);
    }
    return "";
  }

  function normalizeVoiceText(text) {
    return String(text)
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function ensureVoiceRange() {
    const editable = getVoiceEditable();
    if (!editable) return null;
    editable.focus({ preventScroll: true });

    const selection = window.getSelection();
    if (!selection) return null;

    const placeholderRange = getPlaceholderRange(editable);
    if (placeholderRange) {
      selection.removeAllRanges();
      selection.addRange(placeholderRange);
    } else if (
      dictationRangeRef.current &&
      editable.contains(dictationRangeRef.current.startContainer)
    ) {
      selection.removeAllRanges();
      selection.addRange(dictationRangeRef.current.cloneRange());
    } else if (
      dictationCaretRef.current &&
      dictationCaretRef.current.pageIndex ===
        pageRefs.current.findIndex((el) => el === editable)
    ) {
      const restored = createRangeFromTextOffset(
        editable,
        dictationCaretRef.current.offset,
      );
      selection.removeAllRanges();
      selection.addRange(restored);
    }

    if (!selection.rangeCount || !editable.contains(selection.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    let range = selection.getRangeAt(0);
    if (range.collapsed && !placeholderRange) {
      const maybePlaceholder = getPlaceholderRange(editable);
      if (maybePlaceholder) {
        selection.removeAllRanges();
        selection.addRange(maybePlaceholder);
        range = maybePlaceholder.cloneRange();
      }
    }

    let anchor = selection.anchorNode;
    if (anchor && anchor.nodeType === Node.TEXT_NODE)
      anchor = anchor.parentElement;
    const numSpan = anchor && anchor.closest?.(".num");
    if (numSpan) {
      range = document.createRange();
      range.setStartAfter(numSpan);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    dictationRangeRef.current = range.cloneRange();
    const pageIndex = pageRefs.current.findIndex((el) => el === editable);
    if (pageIndex >= 0) {
      focusedPageIndexRef.current = pageIndex;
      dictationCaretRef.current = {
        pageIndex,
        offset: getRangeTextOffset(editable, range),
      };
    }
    return { editable, selection, range, pageIndex };
  }

  function clearVoiceInterim(commit = false) {
    const interim = interimNodeRef.current;
    if (!interim?.isConnected) {
      interimNodeRef.current = null;
      return;
    }
    const text = interim.textContent || "";
    const selection = window.getSelection();
    const range = document.createRange();
    if (commit && text) {
      const node = document.createTextNode(text);
      interim.replaceWith(node);
      range.setStartAfter(node);
      range.collapse(true);
    } else {
      const parent = interim.parentNode;
      range.setStart(
        parent || document.body,
        Array.prototype.indexOf.call(parent?.childNodes || [], interim),
      );
      range.collapse(true);
      interim.remove();
    }
    interimNodeRef.current = null;
    selection?.removeAllRanges();
    selection?.addRange(range);
    dictationRangeRef.current = range.cloneRange();
    const editable = pageRefs.current.find(
      (el) => el && el.contains(range.startContainer),
    );
    const pageIndex = pageRefs.current.findIndex((el) => el === editable);
    if (editable && pageIndex >= 0) {
      dictationCaretRef.current = {
        pageIndex,
        offset: getRangeTextOffset(editable, range),
      };
    }
  }

  function renderVoiceTranscript(text, isFinal) {
    const normalizedText = normalizeVoiceText(text);
    if (!normalizedText) return;
    const target = ensureVoiceRange();
    if (!target) {
      setStatus("Click into a page to dictate");
      return;
    }
    const { editable, selection, pageIndex } = target;
    const existingInterim = interimNodeRef.current?.isConnected
      ? interimNodeRef.current
      : null;
    let finalText = normalizedText;

    if (!existingInterim) {
      const beforeChar = getTextPrefix(target.range);
      if (beforeChar && !/\s/.test(beforeChar) && !/^\s/.test(finalText)) {
        finalText = ` ${finalText}`;
      }
      if (!isFinal) {
        snapshotDraft();
        const span = document.createElement("span");
        span.className = "voice-interim";
        span.textContent = finalText;
        target.range.deleteContents();
        target.range.insertNode(span);
        const after = document.createRange();
        after.setStartAfter(span);
        after.collapse(true);
        selection.removeAllRanges();
        selection.addRange(after);
        dictationRangeRef.current = after.cloneRange();
        dictationCaretRef.current = {
          pageIndex,
          offset: getRangeTextOffset(editable, after),
        };
        interimNodeRef.current = span;
        if (pageIndex >= 0) syncActivePage(pageIndex);
        return;
      }

      snapshotDraft();
      target.range.deleteContents();
      const node = document.createTextNode(finalText);
      target.range.insertNode(node);
      editable.dispatchEvent(
        new Event("input", {
          bubbles: true,
        }),
      );
      const after = document.createRange();
      after.setStartAfter(node);
      after.collapse(true);
      selection.removeAllRanges();
      selection.addRange(after);
      dictationRangeRef.current = after.cloneRange();
      dictationCaretRef.current = {
        pageIndex,
        offset: getRangeTextOffset(editable, after),
      };
      if (pageIndex >= 0) syncActivePage(pageIndex);
      return;
    }

    const normalizedInterim = normalizeVoiceText(text);
    existingInterim.textContent = normalizedInterim;
    const after = document.createRange();
    if (isFinal) {
      const node = document.createTextNode(normalizedInterim);
      existingInterim.replaceWith(node);
      editable.dispatchEvent(
        new Event("input", {
          bubbles: true,
        }),
      );
      interimNodeRef.current = null;
      after.setStartAfter(node);
    } else {
      after.setStartAfter(existingInterim);
    }
    after.collapse(true);
    selection.removeAllRanges();
    selection.addRange(after);
    dictationRangeRef.current = after.cloneRange();
    dictationCaretRef.current = {
      pageIndex,
      offset: getRangeTextOffset(editable, after),
    };
    if (pageIndex >= 0) syncActivePage(pageIndex);
  }

  async function exportToPdf() {
    if (!activeDraft) {
      setStatus("Open a draft first");
      return;
    }

    const editable = pageRefs.current.find(Boolean);
    if (editable) editable.blur();

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const stage = document.createElement("div");
      stage.className = "pdf-export-stage";

      stage.innerHTML = `
      <div class="paper-stack">
        ${activeDraft.pages
          .map(
            (page, index) => `
              <article class="paper">
                <div class="page-content">
                  ${page || "<p><br></p>"}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    `;

      document.body.appendChild(stage);

      await document.fonts?.ready;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageNodes = stage.querySelectorAll(".paper");

      for (let i = 0; i < pageNodes.length; i++) {
        const pageNode = pageNodes[i];

        const canvas = await html2canvas(pageNode, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");

        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          imgData,
          "PNG",
          0,
          0,
          pdfWidth,
          pdfHeight,
          undefined,
          "FAST",
        );
      }

      pdf.save(`${activeDraft.name || "agreement"}.pdf`);

      setStatus("PDF downloaded");
    } catch (error) {
      console.error("PDF Export Error:", error);
      setStatus("Failed to export PDF");
    } finally {
      const stage = document.querySelector(".pdf-export-stage");
      if (stage) stage.remove();
    }
  }

  function polishDictation(text, lang, interim = false) {
    let value = normalizeVoiceText(text);
    if (!value) return "";
    if (!interim && /^(en|fr|de|es|it|pt|nl|sv|da|no)/i.test(lang || "")) {
      value = value.charAt(0).toUpperCase() + value.slice(1);
    }
    return value;
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!activeDraftRef.current) return;
      const target = event.target;
      const isTypingSurface =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (!isTypingSurface && !activeDraftRef.current) return;
        event.preventDefault();
        if (event.shiftKey) redoEdit();
        else undoEdit();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        if (!isTypingSurface) return;
        event.preventDefault();
        redoEdit();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "b"
      ) {
        if (!isTypingSurface) return;
        event.preventDefault();
        execFormat("bold");
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "i"
      ) {
        if (!isTypingSurface) return;
        event.preventDefault();
        execFormat("italic");
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "u"
      ) {
        if (!isTypingSurface) return;
        event.preventDefault();
        execFormat("underline");
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeDraft]);

  return (
    <div className="studio-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-title">Agreement Studio</div>
          <div className="brand-sub">
            Next.js architecture · drafts stay in memory
          </div>
        </div>

        <label className="search-box">
          <span>Search templates</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rent, affidavit, power of attorney..."
          />
        </label>

        <div className="panel">
          <div className="panel-head">
            <h2>Templates</h2>
          </div>
          <div className="list">
            {!backendAvailable ? (
              <div className="empty">
                ⚠ Backend is not running.
                <br />
                Please start the backend server to load templates.
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="empty">No templates match your search.</div>
            ) : (
              filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="card template-card"
                  onClick={() => createDraftFromTemplate(template)}
                >
                  <div className="card-icon">{template.icon || "📄"}</div>
                  <div className="card-body">
                    <div className="card-title">{template.name}</div>
                    <div className="card-meta">
                      {template.category || "General"} ·{" "}
                      {template.pages?.length || 0} page
                      {(template.pages?.length || 0) === 1 ? "" : "s"}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <div className="eyebrow">
              {activeDraft ? "Editing draft" : "Template library"}
            </div>
            <h1>
              {activeDraft ? activeDraft.name : "Choose a template to begin"}
            </h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="btn" onClick={goHome}>
              Home
            </button>
            {/* <button
              type="button"
              className="btn primary"
              onClick={saveActiveDraft}
              disabled={!activeDraft}
            >
              Save
            </button>
            <button
              type="button"
              className="btn"
              onClick={exportToPdf}
              disabled={!activeDraft}
            >
              Export PDF
            </button> */}
            <span className="status">{status}</span>
          </div>
        </header>

        {!activeDraft ? (
          <section className="hero  ">
            <div className="saved-documents">
              <div className="panel-head">
                <h2>Saved Agreements</h2>
              </div>

              {!backendAvailable ? (
                <div className="empty-docs">
                  ⚠ Backend is not running.
                  <br />
                  Please start the backend server to load saved agreements.
                </div>
              ) : documents.length === 0 ? (
                <div className="empty-docs">No saved agreements found</div>
              ) : (
                documents.map((doc) => (
                  <div key={doc._id} className="document-card">
                    <div className="document-info">
                      <h3>{doc.title || doc.templateName}</h3>

                      <p>{doc.templateName}</p>

                      <p className="document-date">
                        {new Date(doc.createdAt).toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="document-actions">
                      <button
                        className="btn-open"
                        onClick={() => openDocument(doc)}
                      >
                        Open
                      </button>

                      <button
                        className="btn-delete"
                        onClick={() => deleteDocument(doc._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : (
          <section className="editor-shell">
            <div className="editor-head">
              <label>
                Draft title
                <input
                  ref={titleRef}
                  type="text"
                  defaultValue={activeDraft.name}
                  onChange={(e) => updateDraftTitle(e.target.value)}
                />
              </label>
              <div className="editor-note">
                This draft exists only for the current browser session.
              </div>
            </div>

            {false ? (
              <section className="form-card">
                <div className="panel-head form-head">
                  <div>
                    <h2>Rent agreement variables</h2>
                    <p>
                      Change the names and other variable details here. This
                      updates the agreement text in place and does not add a
                      separate page.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={applyFormToDraft}
                  >
                    Apply changes
                  </button>
                </div>
                <div className="form-grid compact">
                  <label>
                    Tenant name
                    <input
                      value={formValues.tenantName}
                      onChange={(e) =>
                        updateFormValue("tenantName", e.target.value)
                      }
                      placeholder="First party name"
                    />
                  </label>
                  <label>
                    Tenant relation
                    <input
                      value={formValues.tenantRelation}
                      onChange={(e) =>
                        updateFormValue("tenantRelation", e.target.value)
                      }
                      placeholder="पत्नी / पुत्र / पुत्री"
                    />
                  </label>
                  <label>
                    Tenant family name
                    <input
                      value={formValues.tenantFamilyName}
                      onChange={(e) =>
                        updateFormValue("tenantFamilyName", e.target.value)
                      }
                      placeholder="Father or spouse name"
                    />
                  </label>
                  <label>
                    Tenant age
                    <input
                      value={formValues.tenantAge}
                      onChange={(e) =>
                        updateFormValue("tenantAge", e.target.value)
                      }
                      placeholder="Age in years"
                    />
                  </label>
                  <label>
                    Tenant address
                    <input
                      value={formValues.tenantAddress}
                      onChange={(e) =>
                        updateFormValue("tenantAddress", e.target.value)
                      }
                      placeholder="Tenant residence"
                    />
                  </label>
                  <label>
                    Landlord name
                    <input
                      value={formValues.landlordName}
                      onChange={(e) =>
                        updateFormValue("landlordName", e.target.value)
                      }
                      placeholder="Second party name"
                    />
                  </label>
                  <label>
                    Landlord relation
                    <input
                      value={formValues.landlordRelation}
                      onChange={(e) =>
                        updateFormValue("landlordRelation", e.target.value)
                      }
                      placeholder="पुत्र / पत्नी / पुत्री"
                    />
                  </label>
                  <label>
                    Landlord family name
                    <input
                      value={formValues.landlordFamilyName}
                      onChange={(e) =>
                        updateFormValue("landlordFamilyName", e.target.value)
                      }
                      placeholder="Father or spouse name"
                    />
                  </label>
                  <label>
                    Landlord age
                    <input
                      value={formValues.landlordAge}
                      onChange={(e) =>
                        updateFormValue("landlordAge", e.target.value)
                      }
                      placeholder="Age in years"
                    />
                  </label>
                  <label>
                    Landlord address
                    <input
                      value={formValues.landlordAddress}
                      onChange={(e) =>
                        updateFormValue("landlordAddress", e.target.value)
                      }
                      placeholder="Landlord residence"
                    />
                  </label>
                  <label>
                    Property address
                    <input
                      value={formValues.propertyAddress}
                      onChange={(e) =>
                        updateFormValue("propertyAddress", e.target.value)
                      }
                      placeholder="Rented property address"
                    />
                  </label>
                  <label>
                    Monthly rent
                    <input
                      value={formValues.rentAmount}
                      onChange={(e) =>
                        updateFormValue("rentAmount", e.target.value)
                      }
                      placeholder="2,000/-"
                    />
                  </label>
                  <label>
                    Agreement date
                    <input
                      value={formValues.agreementDate}
                      onChange={(e) =>
                        updateFormValue("agreementDate", e.target.value)
                      }
                      placeholder="15-05-2026"
                    />
                  </label>
                  <label>
                    Duration
                    <input
                      value={formValues.duration}
                      onChange={(e) =>
                        updateFormValue("duration", e.target.value)
                      }
                      placeholder="11 माह"
                    />
                  </label>
                  <label>
                    Witness 1
                    <input
                      value={formValues.witnessOne}
                      onChange={(e) =>
                        updateFormValue("witnessOne", e.target.value)
                      }
                      placeholder="First witness"
                    />
                  </label>
                  <label>
                    Witness 2
                    <input
                      value={formValues.witnessTwo}
                      onChange={(e) =>
                        updateFormValue("witnessTwo", e.target.value)
                      }
                      placeholder="Second witness"
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <div className="toolbar">
              <div className="tool-group">
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execFormat("bold")}
                >
                  <b>B</b>
                </button>
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execFormat("italic")}
                >
                  <i>I</i>
                </button>
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execFormat("underline")}
                >
                  <u>U</u>
                </button>
              </div>
              <div className="tool-group">
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execFormat("justifyLeft")}
                >
                  ⫷
                </button>
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execFormat("justifyCenter")}
                >
                  ≡
                </button>
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execFormat("justifyRight")}
                >
                  ⫸
                </button>
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execFormat("justifyFull")}
                >
                  ▤
                </button>
              </div>
              <div className="tool-group">
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execFormat("insertOrderedList")}
                >
                  1.
                </button>
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execFormat("insertUnorderedList")}
                >
                  •
                </button>
              </div>
              <div className="tool-group">
                <select
                  className="tool font-size"
                  defaultValue=""
                  onMouseDown={() => {
                    const selection = window.getSelection();
                    if (selection?.rangeCount) {
                      savedRangeRef.current = selection
                        .getRangeAt(0)
                        .cloneRange();
                    } else {
                      savedRangeRef.current = null;
                    }
                  }}
                  onChange={(e) => {
                    const px = parseInt(e.target.value, 10);
                    e.target.value = "";
                    if (!px) return;
                    const savedRange = savedRangeRef.current;
                    if (savedRange) {
                      const selection = window.getSelection();
                      selection?.removeAllRanges();
                      selection?.addRange(savedRange);
                    }
                    setFontSize(px);
                    savedRangeRef.current = null;
                  }}
                >
                  <option value="">Size</option>
                  {FONT_LADDER.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => stepFontSize(-1)}
                >
                  A−
                </button>
                <button
                  type="button"
                  className="tool fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => stepFontSize(+1)}
                >
                  A+
                </button>
              </div>
              <div className="tool-group">
                <button
                  type="button"
                  className="tool"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={insertTwoColAtCursor}
                >
                  ▦ 2-col
                </button>
                <button
                  type="button"
                  className="tool"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertHtmlAtCursor("<p><br></p>")}
                >
                  ⊟ Page
                </button>
                <button
                  type="button"
                  className="tool"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={deletePageAtCursor}
                >
                  ✕ Page
                </button>
              </div>
              <div className="tool-group">
                <select
                  className="tool lang-select"
                  value={voiceLang}
                  onChange={(e) => setVoiceLang(e.target.value)}
                >
                  {VOICE_LANGS.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`tool voice${voiceActive ? " recording" : ""}`}
                  onMouseDown={(e) => {
                    rememberEditorRange();
                    e.preventDefault();
                  }}
                  onClick={toggleVoice}
                >
                  <span className="mic-dot" /> Voice
                </button>
              </div>
            </div>

            <div className="paper-stack">
              {activeDraft.pages.map((page, pageIndex) => (
                <article
                  className="paper"
                  key={`${activeDraft.id}-${pageIndex}`}
                >
                  <div className="page-label">Page {pageIndex + 1}</div>
                  <div
                    ref={(el) => {
                      pageRefs.current[pageIndex] = el;
                    }}
                    className="page-content"
                    contentEditable
                    suppressContentEditableWarning
                    onFocus={() => {
                      focusedPageIndexRef.current = pageIndex;
                      rememberEditorRange(pageIndex);
                      setStatus(`Editing page ${pageIndex + 1}`);
                    }}
                    onClick={() => {
                      focusedPageIndexRef.current = pageIndex;
                      setActivePage(pageIndex);
                      rememberEditorRange(pageIndex);
                    }}
                    onMouseUp={() => {
                      focusedPageIndexRef.current = pageIndex;
                      rememberEditorRange(pageIndex);
                    }}
                    onKeyUp={() => {
                      focusedPageIndexRef.current = pageIndex;
                      rememberEditorRange(pageIndex);
                    }}
                    onBeforeInput={(e) => {
                      const nativeEvent = e.nativeEvent;
                      const data = nativeEvent.data ?? "";
                      if (
                        nativeEvent.inputType === "insertText" &&
                        data &&
                        insertIntoPlaceholder(e.currentTarget, data)
                      ) {
                        e.preventDefault();
                        capturePageEdit(pageIndex);
                        updatePageHtml(pageIndex, e.currentTarget.innerHTML);
                        return;
                      }
                      clearPlaceholderAtSelection(e.currentTarget);
                      capturePageEdit(pageIndex);
                    }}
                    onInput={(e) =>
                      updatePageHtml(pageIndex, e.currentTarget.innerHTML)
                    }
                    onKeyDown={(event) => {
                      if (
                        (event.ctrlKey || event.metaKey) &&
                        ["b", "i", "u"].includes(event.key.toLowerCase())
                      ) {
                        event.preventDefault();
                      }
                    }}
                  />
                </article>
              ))}
            </div>
            <div className="editor-footer">
              <button
                type="button"
                className="btn primary"
                onClick={saveAggrement}
              >
                Save
              </button>

              <button type="button" className="btn" onClick={exportToPdf}>
                Export PDF
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
