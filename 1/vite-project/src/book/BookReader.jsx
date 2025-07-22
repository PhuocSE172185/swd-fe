import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ePub from 'epubjs';
import './BookReader.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const BookReader = () => {
  const { id } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const chapterId = queryParams.get('chapterId');
  const [fileUrl, setFileUrl] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [toc, setToc] = useState([]); // mục lục thực của epub
  const [chapters, setChapters] = useState([]); // chapters từ API
  const [selectedToc, setSelectedToc] = useState(null);
  const [currentChapter, setCurrentChapter] = useState(null); // chapter hiện tại
  const [currentChapterIndex, setCurrentChapterIndex] = useState(null); // index của chapter hiện tại
  const [aiResult, setAiResult] = useState(null); // kết quả AI
  const [aiLoading, setAiLoading] = useState(false); // loading AI
  const [aiType, setAiType] = useState(''); // loại AI đang chạy
  const [showAiPanel, setShowAiPanel] = useState(false); // hiển thị panel AI
  const [selectedText, setSelectedText] = useState(''); // Thêm state lưu đoạn văn được chọn
  
  // Note states
  const [contextMenu, setContextMenu] = useState(null); // { x, y, selectedText }
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState('#ffff00'); // default yellow
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [currentCfi, setCurrentCfi] = useState('');
  const [notes, setNotes] = useState([]); // Thêm state để lưu notes
  
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);
  const epubBookRef = useRef(null);

  // Fetch notes cho chapter hiện tại - SỬA ENDPOINT
  const fetchChapterNotes = async (chapterId) => {
    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      // Sử dụng endpoint /list với filter chapterId
      const response = await fetch(`${API_BASE_URL}/chapter-notes/list?chapterId=${chapterId}&pageSize=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      console.log('Notes fetched for chapter:', chapterId, result);
      if (response.ok && result.data && result.data.data) {
        const notesData = Array.isArray(result.data.data) ? result.data.data : [];
        setNotes(notesData);
        // Áp dụng highlights lên EPUB reader
        applyHighlightsToReader(notesData);
      } else {
        setNotes([]);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    }
  };

  // Inject CSS vào iframe để force highlights hiển thị
  const injectHighlightCSS = () => {
    try {
      const iframe = viewerRef.current?.querySelector('iframe');
      if (iframe && iframe.contentDocument) {
        const doc = iframe.contentDocument;
        
        // Check if CSS already injected
        if (doc.getElementById('highlight-styles')) {
          return;
        }
        
        const style = doc.createElement('style');
        style.id = 'highlight-styles';
        style.textContent = `
          .manual-highlight,
          .epub-highlight,
          .highlight {
            background-color: rgba(255, 255, 0, 0.8) !important;
            border: 2px solid #ffc107 !important;
            border-radius: 4px !important;
            padding: 2px 4px !important;
            box-shadow: 0 2px 4px rgba(255, 193, 7, 0.4) !important;
            display: inline !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 9999 !important;
            position: relative !important;
          }
          
          .manual-highlight:hover,
          .epub-highlight:hover,
          .highlight:hover {
            background-color: rgba(255, 255, 0, 1) !important;
            border-color: #ff9800 !important;
            cursor: pointer !important;
          }
          
          [data-highlight-id] {
            background-color: yellow !important;
            border: 2px solid orange !important;
            padding: 2px !important;
            border-radius: 3px !important;
            display: inline !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          
          /* Force any existing highlights */
          span[style*="background"] {
            background-color: rgba(255, 255, 0, 0.8) !important;
            border: 1px solid #ffc107 !important;
            border-radius: 2px !important;
            padding: 1px 2px !important;
          }
        `;
        
        doc.head.appendChild(style);
        console.log('✅ Injected highlight CSS into iframe');
      }
    } catch (error) {
      console.error('❌ Failed to inject CSS:', error);
    }
  };

  // Áp dụng highlights lên EPUB reader - ENHANCED METHODS
  const applyHighlightsToReader = (notesData) => {
    if (!renditionRef.current || !notesData.length) {
      console.log('Cannot apply highlights: no rendition or no notes');
      return;
    }

    try {
      console.log('Applying highlights to reader:', notesData);
      
      // Lọc chỉ lấy highlights có CFI
      const highlights = notesData.filter(note => 
        note.note_type === 2 && note.cfi && note.highlighted_text
      );

      console.log('Valid highlights with CFI:', highlights);

      if (highlights.length === 0) {
        console.log('No valid highlights to apply');
        return;
      }

      highlights.forEach((highlight, index) => {
        try {
          console.log(`Processing highlight ${index + 1}:`, {
            id: highlight.id,
            cfi: highlight.cfi,
            text: highlight.highlighted_text?.substring(0, 50) + '...',
            color: highlight.color
          });

          const highlightColor = highlight.color || "#ffff00";
          let success = false;
          
          // Method 1: Direct iframe DOM manipulation (MỚI - thử trước)
          try {
            const iframe = viewerRef.current?.querySelector('iframe');
            if (iframe && iframe.contentDocument) {
              const doc = iframe.contentDocument;
              
              // Tìm text trong iframe document
              const walker = doc.createTreeWalker(
                doc.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
              );
              
              let textNode;
              const searchText = highlight.highlighted_text.substring(0, 30); // Lấy đoạn đầu để tìm
              
              // eslint-disable-next-line no-cond-assign
              while ((textNode = walker.nextNode())) {
                if (textNode.textContent.includes(searchText)) {
                  try {
                    const range = doc.createRange();
                    const startIndex = textNode.textContent.indexOf(searchText);
                    range.setStart(textNode, startIndex);
                    range.setEnd(textNode, startIndex + searchText.length);
                    
                    const span = doc.createElement('span');
                    span.style.backgroundColor = highlightColor;
                    span.style.opacity = '0.6';
                    span.style.borderRadius = '2px';
                    span.style.padding = '1px 2px';
                    span.className = 'manual-highlight';
                    span.setAttribute('data-highlight-id', highlight.id);
                    
                    range.surroundContents(span);
                    console.log(`✅ Direct iframe DOM success for: ${highlight.cfi}`);
                    success = true;
                    break;
                  } catch (domError) {
                    // eslint-disable-next-line no-unused-vars
                    console.log('DOM manipulation failed, continue searching...', domError);
                  }
                }
              }
            }
          } catch (iframeError) {
            console.log(`Iframe method failed for highlight ${index + 1}:`, iframeError);
          }

          if (success) return; // Nếu đã thành công, skip các method khác

          // Method 2: Mark API
          try {
            renditionRef.current.mark(highlight.cfi, {
              type: "highlight",
              data: {
                id: highlight.id,
                text: highlight.highlighted_text
              }
            }, (range) => {
              if (range) {
                const span = range.commonAncestorContainer.ownerDocument.createElement("span");
                span.style.backgroundColor = highlightColor;
                span.style.opacity = "0.6";
                span.style.borderRadius = "2px";
                span.style.padding = "1px 2px";
                span.className = "epub-highlight";
                range.surroundContents(span);
                console.log(`✅ Mark method success for CFI: ${highlight.cfi}`);
                success = true;
                return span;
              }
            });
          } catch (markError) {
            // eslint-disable-next-line no-unused-vars
            console.log(`Mark method failed for highlight ${index + 1}, trying annotations...`, markError);
          }

          if (success) return;

          // Method 3: annotations.add
          try {
            renditionRef.current.annotations.add(
              "highlight",
              highlight.cfi,
              {},
              null,
              "highlight",
              {
                fill: highlightColor,
                "fill-opacity": "0.6",
                "mix-blend-mode": "multiply"
              }
            );
            console.log(`✅ Annotations method success for CFI: ${highlight.cfi}`);
            success = true;
          } catch (annotError) {
            // eslint-disable-next-line no-unused-vars
            console.log(`Annotations failed for highlight ${index + 1}, trying underline...`, annotError);
            
            // Method 4: underline method
            try {
              renditionRef.current.annotations.add(
                "underline",
                highlight.cfi,
                {},
                null,
                "underline",
                {
                  stroke: highlightColor,
                  "stroke-width": "3px",
                  "stroke-opacity": "0.8"
                }
              );
              console.log(`✅ Underline method success for CFI: ${highlight.cfi}`);
              success = true;
            } catch (underlineError) {
              // eslint-disable-next-line no-unused-vars
              console.log(`All methods failed for highlight ${index + 1}`, underlineError);
            }
          }

        } catch (error) {
          console.error(`❌ Outer error for highlight ${index + 1}:`, error, highlight);
        }
      });

      // Event listeners
      renditionRef.current.on("markClicked", (cfiRange, data) => {
        console.log("Highlight clicked:", cfiRange, data);
      });

      console.log(`🎯 Finished processing ${highlights.length} highlights`);

    } catch (error) {
      console.error('❌ Error in applyHighlightsToReader:', error);
    }
  };

  // Xóa highlight khỏi reader (để sử dụng sau này)
  // eslint-disable-next-line no-unused-vars
  const removeHighlightFromReader = (noteId, cfi) => {
    if (!renditionRef.current || !cfi) return;
    
    try {
      renditionRef.current.annotations.remove(cfi, "highlight");
      console.log('Removed highlight from reader:', noteId, cfi);
    } catch (error) {
      console.error('Error removing highlight:', error);
    }
  };

  // Fetch notes khi chuyển chapter
  useEffect(() => {
    if (currentChapter?.id) {
      console.log('Fetching notes for current chapter:', currentChapter.id);
      fetchChapterNotes(currentChapter.id);
    }
  }, [currentChapter]);

  // Lấy file_url và title
  useEffect(() => {
    const fetchBook = async () => {
      try {
        console.log('Fetching book data for ID:', id);
        const response = await fetch(`${API_BASE_URL}/books/${id}`, { method: 'GET' });
        const res = await response.json();
        console.log('Book data response:', res);
        if (response.ok && res.data && res.data.file_url) {
          setFileUrl(res.data.file_url);
          setBookTitle(res.data.title || '');
          console.log('Book loaded:', { fileUrl: res.data.file_url, title: res.data.title });
        }
      } catch (error) { 
        console.error('Error fetching book:', error);
        return; 
      }
    };
    fetchBook();
  }, [id]);

  // Lấy chapters từ API để mapping
  useEffect(() => {
    const fetchChapters = async () => {
      try {
        console.log('Fetching chapters for book ID:', id);
        const response = await fetch(`${API_BASE_URL}/books/${id}/chapters`, { method: 'GET' });
        const res = await response.json();
        console.log('Chapters response:', res);
        if (response.ok && Array.isArray(res.data)) {
          setChapters(res.data);
          console.log('Chapters loaded:', res.data.length);
        } else if (response.ok && res.data && Array.isArray(res.data.data)) {
          setChapters(res.data.data);
          console.log('Chapters loaded from nested data:', res.data.data.length);
        }
      } catch (error) { 
        console.error('Error fetching chapters:', error);
        return; 
      }
    };
    fetchChapters();
  }, [id]);

  // Hàm tìm chapter trong cây chapters (để xử lý nested chapters)
  const findChapterById = (chapters, targetId) => {
    for (const chapter of chapters) {
      if (String(chapter.id) === String(targetId)) {
        return chapter;
      }
      if (chapter.child_chapters && chapter.child_chapters.length > 0) {
        const found = findChapterById(chapter.child_chapters, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  // Hàm flatten để xử lý nested structure
  const flattenChapters = (chapterList, result = []) => {
    for (const ch of chapterList) {
      result.push(ch);
      if (ch.child_chapters && ch.child_chapters.length > 0) {
        flattenChapters(ch.child_chapters, result);
      }
    }
    return result;
  };

  const flattenToc = (tocList, result = []) => {
    for (const item of tocList) {
      result.push(item);
      if (item.subitems && item.subitems.length > 0) {
        flattenToc(item.subitems, result);
      }
    }
    return result;
  };

  // Hàm gọi AI API - SỬA LẠI REQUEST FORMAT
  const callAiApi = async (action, chapterIndex) => {
    if (chapterIndex === null || chapterIndex === undefined) {
      console.error('Không tìm thấy chapter để xử lý AI');
      alert('Không tìm thấy chapter để xử lý AI');
      return;
    }

    setAiLoading(true);
    setAiType(action);
    setShowAiPanel(true);
    setAiResult(null);

    let chapter = null; // Declare chapter outside try block

    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const flatChapters = flattenChapters(chapters);
      chapter = flatChapters[chapterIndex]; // Assign chapter here
      if (!chapter || !chapter.id) {
        console.error('Không tìm thấy chapterId:', chapter);
        throw new Error('Không tìm thấy chapterId');
      }

      const apiUrl = `${API_BASE_URL}/book-ai/${id}/chapters/${chapter.id}/process-ai`;
      const contentToSend = selectedText || '';

      // Thử các format request body khác nhau
      let requestBody;
      
      // Format 1: Chỉ action string
      if (!contentToSend) {
        requestBody = {
          actions: [action]
        };
      } else {
        // Format 2: Có content
        requestBody = {
          actions: [action],
          content: contentToSend
        };
      }

      // Log dữ liệu gửi lên API
      console.log('Gửi AI API:', {
        url: apiUrl,
        method: 'POST',
        body: requestBody,
        bookId: id,
        chapterId: chapter.id,
        action: action
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(requestBody)
      });

      console.log('AI API Response Status:', response.status);
      console.log('AI API Response Headers:', Object.fromEntries(response.headers.entries()));

      const contentType = response.headers.get('content-type');
      let result;
      
      if (!contentType || !contentType.includes('application/json')) {
        // Nếu không phải JSON
        const textResult = await response.text();
        console.log('AI API Non-JSON Response:', textResult);
        
        if (response.ok) {
          result = { message: textResult || 'Xử lý thành công nhưng không có dữ liệu trả về' };
        } else {
          throw new Error(`HTTP ${response.status}: ${textResult || 'Không có thông tin lỗi'}`);
        }
      } else {
        // Nếu là JSON
        result = await response.json();
        console.log('AI API JSON Response:', result);
        
        if (!response.ok) {
          // Xử lý lỗi từ server
          let errorMessage = 'Có lỗi xảy ra khi gọi AI';
          
          if (result.message) {
            errorMessage = result.message;
          } else if (result.error) {
            errorMessage = result.error;
          } else if (result.data && result.data.message) {
            errorMessage = result.data.message;
          }
          
          throw new Error(errorMessage);
        }
      }
      
      // Xử lý response thành công
      if (result.data && typeof result.data === 'object') {
        // Nếu có nested data
        setAiResult(result.data);
      } else {
        // Nếu result trực tiếp
        setAiResult(result);
      }
      
    } catch (error) {
      console.error('AI API Error Details:', {
        error: error,
        message: error.message,
        stack: error.stack,
        action: action,
        chapterId: chapter?.id || 'unknown'
      });
      
      let errorMessage = 'Có lỗi xảy ra khi gọi AI';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Không thể kết nối tới server. Vui lòng kiểm tra kết nối mạng.';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Server trả về dữ liệu không hợp lệ';
      } else if (error.message.includes('Invalid input data')) {
        errorMessage = 'Dữ liệu đầu vào không hợp lệ. Vui lòng thử lại.';
      } else if (error.message.includes('400')) {
        errorMessage = 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.';
      } else {
        errorMessage = error.message;
      }
      
      setAiResult({ error: errorMessage });
    } finally {
      setAiLoading(false);
    }
  };

  // Hàm mapping chapter từ API với TOC epub dựa trên title hoặc thứ tự
  const findTocItemByChapter = (toc, chapter, chapters) => {
    // Method 1: Tìm theo title (nếu title khớp)
    const findByTitle = (tocList) => {
      for (const item of tocList) {
        if (item.label && chapter.title && 
            item.label.toLowerCase().includes(chapter.title.toLowerCase()) ||
            chapter.title.toLowerCase().includes(item.label.toLowerCase())) {
          return item;
        }
        if (item.subitems && item.subitems.length) {
          const found = findByTitle(item.subitems);
          if (found) return found;
        }
      }
      return null;
    };

    // Method 2: Tìm theo thứ tự (index) - flatten cả chapters và toc
    const flattenChapters = (chapterList, result = []) => {
      for (const ch of chapterList) {
        result.push(ch);
        if (ch.child_chapters && ch.child_chapters.length > 0) {
          flattenChapters(ch.child_chapters, result);
        }
      }
      return result;
    };

    const flattenToc = (tocList, result = []) => {
      for (const item of tocList) {
        result.push(item);
        if (item.subitems && item.subitems.length > 0) {
          flattenToc(item.subitems, result);
        }
      }
      return result;
    };

    // Thử method 1 trước
    let found = findByTitle(toc);
    if (found) return found;

    // Nếu không tìm thấy theo title, thử method 2 (theo index)
    const flatChapters = flattenChapters(chapters);
    const flatToc = flattenToc(toc);
    const chapterIndex = flatChapters.findIndex(ch => String(ch.id) === String(chapter.id));
    
    if (chapterIndex >= 0 && chapterIndex < flatToc.length) {
      return flatToc[chapterIndex];
    }

    return null;
  };

  // Hàm lấy CFI từ rendition
  const getCurrentCfi = () => {
    try {
      if (renditionRef.current && renditionRef.current.currentLocation) {
        const location = renditionRef.current.currentLocation();
        console.log('Current location:', location);
        return location?.start?.cfi || '';
      }
    } catch (error) {
      console.error('Error getting CFI:', error);
    }
    return '';
  };

  // Hàm lấy page number (tạm thời sử dụng location)
  const getCurrentPageNumber = () => {
    try {
      if (renditionRef.current && renditionRef.current.currentLocation) {
        const location = renditionRef.current.currentLocation();
        console.log('Current location for page:', location);
        return location?.start?.displayed?.page || 1;
      }
    } catch (error) {
      console.error('Error getting page number:', error);
    }
    return 1;
  };

  // Hàm xử lý context menu (chuột phải)
  const handleContextMenu = (event) => {
    event.preventDefault();
    console.log('Context menu triggered at:', { x: event.clientX, y: event.clientY });
    
    // Lấy text được chọn
    let selectedTextContent = '';
    const iframe = viewerRef.current?.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      selectedTextContent = iframe.contentWindow.getSelection().toString().trim();
    } else {
      selectedTextContent = window.getSelection().toString().trim();
    }
    
    console.log('Selected text for context menu:', selectedTextContent);
    
    // Lấy thông tin trang và CFI hiện tại
    const cfi = getCurrentCfi();
    const pageNum = getCurrentPageNumber();
    setCurrentCfi(cfi);
    setCurrentPageNumber(pageNum);
    
    console.log('Current page info:', { cfi, pageNum });
    
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      selectedText: selectedTextContent
    });
    setSelectedText(selectedTextContent);
  };

  // Hàm tạo note
  const createNote = async (type) => {
    console.log('Creating note with type:', type);
    console.log('Current chapter:', currentChapter);
    console.log('Selected text:', selectedText);
    
    if (!currentChapter) {
      console.error('No current chapter found');
      alert('Please select a chapter first');
      return;
    }

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
      console.error('No authentication token found');
      alert('Please login first');
      return;
    }

    setContextMenu(null);
    
    if (type === 'highlight') {
      if (!selectedText) {
        console.error('No text selected for highlight');
        alert('Please select text to highlight');
        return;
      }
      // For highlight, we can create immediately without modal
      await submitNote(type, '');
    } else {
      // For text note, show modal to input content
      setShowNoteModal(true);
    }
  };

  // Hàm submit note
  const submitNote = async (type, content) => {
    console.log('Submitting note:', {
      type,
      content,
      selectedText,
      currentChapter: currentChapter?.id,
      pageNumber: currentPageNumber,
      cfi: currentCfi,
      color: noteColor
    });

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    
    let noteData = {
      note_type: type === 'text' ? 1 : 2, // TextNote = 1, Highlight = 2
      page_number: currentPageNumber,
      chapter_id: currentChapter.id,
      ...(currentCfi && { cfi: currentCfi }),
      ...(noteColor && { color: noteColor })
    };

    // Add required fields based on note type
    if (type === 'text') {
      if (!content.trim()) {
        alert('Please enter note content');
        return;
      }
      noteData.content = content.trim();
      if (selectedText) {
        noteData.highlighted_text = selectedText; // optional for text notes
      }
    } else if (type === 'highlight') {
      if (!selectedText) {
        alert('No text selected for highlight');
        return;
      }
      noteData.highlighted_text = selectedText;
      if (content.trim()) {
        noteData.content = content.trim(); // optional for highlights
      }
    }

    console.log('Note data to send:', noteData);

    try {
      const response = await fetch(`${API_BASE_URL}/chapter-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(noteData)
      });

      const result = await response.json();
      console.log('Create note response:', result);

      if (response.ok) {
        alert(`${type === 'text' ? 'Text note' : 'Highlight'} created successfully!`);
        console.log('Note created successfully:', result);
        // Fetch lại notes sau khi tạo thành công
        fetchChapterNotes(currentChapter.id);
      } else {
        console.error('Failed to create note:', result);
        alert(result.message || 'Failed to create note');
      }
    } catch (error) {
      console.error('Error creating note:', error);
      alert('Error creating note: ' + error.message);
    }

    // Reset states
    setShowNoteModal(false);
    setNoteContent('');
    setSelectedText('');
  };

  // Render epub và lấy TOC - FIXED HIGHLIGHTS SETUP
  useEffect(() => {
    if (!fileUrl || !viewerRef.current) return;
    
    console.log('Rendering EPUB with fileUrl:', fileUrl);
    
    // Cleanup previous instances
    if (renditionRef.current) {
      renditionRef.current.destroy();
      renditionRef.current = null;
    }
    if (epubBookRef.current) {
      epubBookRef.current.destroy();
      epubBookRef.current = null;
    }

    const epubBook = ePub(fileUrl);
    epubBookRef.current = epubBook;
    
    const rendition = epubBook.renderTo(viewerRef.current, {
      width: '100%',
      height: 600,
      flow: 'paginated',
    });
    renditionRef.current = rendition;

    // Setup themes và styles cho highlights
    rendition.themes.default({
      "::selection": {
        "background": "rgba(255, 255, 0, 0.3)"
      },
      ".highlight": {
        "background-color": "rgba(255, 255, 0, 0.4) !important",
        "border-radius": "2px !important",
        "padding": "1px 2px !important"
      },
      ".underline": {
        "border-bottom": "2px solid #ffff00 !important"
      }
    });

    epubBook.loaded.navigation.then(nav => {
      console.log('EPUB navigation loaded:', nav.toc);
      setToc(nav.toc);
      
      let targetTocItem = nav.toc[0]; // default to first chapter

      // Nếu có chapterId và đã load chapters từ API
      if (chapterId && chapters.length > 0) {
        console.log('Looking for chapter with ID:', chapterId);
        const targetChapter = findChapterById(chapters, chapterId);
        if (targetChapter) {
          console.log('Found target chapter:', targetChapter);
          const mappedTocItem = findTocItemByChapter(nav.toc, targetChapter, chapters);
          if (mappedTocItem) {
            targetTocItem = mappedTocItem;
            console.log('Mapped to TOC item:', mappedTocItem);
          }
          setCurrentChapter(targetChapter); // Lưu chapter hiện tại
          
          // THÊM: Tính toán và lưu chapter index
          const flatChapters = flattenChapters(chapters);
          const chapterIndex = flatChapters.findIndex(ch => String(ch.id) === String(targetChapter.id));
          setCurrentChapterIndex(chapterIndex);
          console.log('Set current chapter index:', chapterIndex);
        }
      } else if (chapters.length > 0) {
        // Nếu không có chapterId, lấy chapter đầu tiên
        const flatChapters = flattenChapters(chapters);
        if (flatChapters.length > 0) {
          setCurrentChapter(flatChapters[0]);
          setCurrentChapterIndex(0);
          console.log('Set first chapter as current:', flatChapters[0]);
        }
      }

      setSelectedToc(targetTocItem);
      
      if (targetTocItem && targetTocItem.href) {
        rendition.display(targetTocItem.href);
        console.log('Displayed chapter:', targetTocItem.href);
      } else {
        rendition.display();
        console.log('Displayed default chapter');
      }
    });

    // Add event listeners after render
    rendition.on('rendered', () => {
      console.log('EPUB rendered, adding event listeners');
      
      // Add context menu listener to iframe
      const iframe = viewerRef.current?.querySelector('iframe');
      if (iframe && iframe.contentDocument) {
        console.log('Adding context menu listener to iframe');
        iframe.contentDocument.addEventListener('contextmenu', handleContextMenu);
      }

      // Inject CSS vào iframe để force highlights hiển thị
      injectHighlightCSS();

      // Áp dụng highlights khi EPUB đã render xong
      if (notes.length > 0) {
        setTimeout(() => {
          console.log('Re-applying highlights after EPUB render');
          applyHighlightsToReader(notes);
        }, 1000); // Tăng delay lên 1s
      }
    });

    // Thêm event listener cho location changed để re-apply highlights
    rendition.on('locationChanged', () => {
      console.log('Location changed, re-applying highlights');
      
      // Re-inject CSS when location changes
      setTimeout(() => {
        injectHighlightCSS();
      }, 100);
      
      if (notes.length > 0) {
        setTimeout(() => {
          applyHighlightsToReader(notes);
        }, 500);
      }
    });

    return () => {
      console.log('Cleaning up EPUB instances');
      if (rendition) rendition.destroy();
      if (epubBook) epubBook.destroy();
    };
  }, [fileUrl, chapterId, chapters]); // Thêm chapters vào dependency

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        console.log('Closing context menu');
        setContextMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  // Khi click vào mục lục
  const handleTocClick = (item) => {
    console.log('TOC clicked:', item);
    setSelectedToc(item);
    if (renditionRef.current && item.href) {
      renditionRef.current.display(item.href);
    }

    // THÊM: Tìm và set current chapter + index khi click TOC
    if (chapters.length > 0) {
      const flatChapters = flattenChapters(chapters);
      const flatToc = flattenToc(toc);
      const tocIndex = flatToc.findIndex(tocItem => tocItem.href === item.href);
      
      if (tocIndex >= 0 && tocIndex < flatChapters.length) {
        setCurrentChapter(flatChapters[tocIndex]);
        setCurrentChapterIndex(tocIndex);
        console.log('Updated current chapter from TOC:', flatChapters[tocIndex]);
      }
    }
  };

  // Prev/Next page
  const handlePrev = () => {
    if (renditionRef.current) {
      console.log('Going to previous page');
      renditionRef.current.prev();
    }
  };
  
  const handleNext = () => {
    if (renditionRef.current) {
      console.log('Going to next page');
      renditionRef.current.next();
    }
  };

  // Hàm lấy đoạn văn khi bôi đen
  const handleTextSelection = () => {
    let text = '';
    // Tìm iframe trong viewer
    const viewer = viewerRef.current;
    if (viewer) {
      const iframe = viewer.querySelector('iframe');
      if (iframe && iframe.contentWindow && iframe.contentWindow.getSelection) {
        text = iframe.contentWindow.getSelection().toString();
      } else if (window.getSelection) {
        text = window.getSelection().toString();
      }
    }
    // Loại bỏ ký tự điều khiển
    text = Array.from(text).filter(ch => ch.charCodeAt(0) >= 32).join('');
    setSelectedText(text);
    if (text) {
      console.log('Text selected:', text);
    }
  };

  // Thêm event listener cho viewer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.addEventListener('mouseup', handleTextSelection);
    return () => {
      viewer.removeEventListener('mouseup', handleTextSelection);
    };
  }, [viewerRef]);

  // Thêm vào useEffect sau khi epub.js render xong
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Lấy iframe sau khi epub.js đã render
    const addIframeListener = () => {
      const iframe = viewer.querySelector('iframe');
      if (iframe) {
        console.log('Adding mouseup listener to iframe');
        iframe.contentWindow.document.addEventListener('mouseup', () => {
          const text = iframe.contentWindow.getSelection().toString();
          // Loại bỏ ký tự điều khiển
          const cleanText = Array.from(text).filter(ch => ch.charCodeAt(0) >= 32).join('');
          setSelectedText(cleanText);
          if (cleanText) {
            console.log('Text selected in iframe:', cleanText);
          }
        });
      }
    };

    // Đợi một chút cho iframe render xong
    const timer = setTimeout(addIframeListener, 1000);

    return () => {
      clearTimeout(timer);
      const iframe = viewer.querySelector('iframe');
      if (iframe) {
        iframe.contentWindow.document.removeEventListener('mouseup', handleTextSelection);
      }
    };
  }, [fileUrl, chapters]);

  return (
    <div className="book-reader-page">
      <div className="sidebar">
        <div className="book-title">{bookTitle}</div>
        <div className="chapter-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
          {toc.map((item, idx) => (
            <button
              key={item.id || idx}
              className={selectedToc?.href === item.href ? 'active' : ''}
              onClick={() => handleTocClick(item)}
            >
              {item.label || `Chapter ${idx + 1}`}
            </button>
          ))}
        </div>

        {/* AI Tools */}
        <div className="ai-tools" style={{ marginTop: 20, padding: 10, borderTop: '1px solid #ddd' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: 14 }}>AI Tools</h4>
          {currentChapter && currentChapterIndex !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 5 }}>
                Chapter: {currentChapter.title} (Index: {currentChapterIndex})
              </div>
              <button 
                className="ai-tools-btn summary"
                onClick={() => callAiApi('summary', currentChapterIndex)}
                disabled={aiLoading}
              >
                {aiLoading && aiType === 'summary' ? 'Generating...' : 'Summarize'}
              </button>
              <button 
                className="ai-tools-btn keywords"
                onClick={() => callAiApi('keywords', currentChapterIndex)}
                disabled={aiLoading}
              >
                {aiLoading && aiType === 'keywords' ? 'Generating...' : 'Keywords'}
              </button>
              <button 
                className="ai-tools-btn translation"
                onClick={() => callAiApi('translation', currentChapterIndex)}
                disabled={aiLoading}
              >
                {aiLoading && aiType === 'translation' ? 'Translating...' : 'Translate'}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#666' }}>Select a chapter to use AI</p>
          )}
        </div>

        {/* Notes Section */}
        {notes.length > 0 && (
          <div style={{ marginTop: 20, padding: 10, borderTop: '1px solid #ddd', maxHeight: 200, overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14 }}>Notes ({notes.length})</h4>
            {notes.map(note => (
              <div key={note.id} style={{ 
                padding: 8, 
                marginBottom: 8, 
                backgroundColor: note.note_type === 2 ? '#fff3cd' : '#d1ecf1',
                borderRadius: 4,
                fontSize: 12,
                borderLeft: `3px solid ${note.color || '#007bff'}`
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                  {note.note_type_name} - Page {note.page_number}
                </div>
                {note.highlighted_text && (
                  <div style={{ 
                    fontStyle: 'italic', 
                    marginBottom: 4,
                    color: '#666',
                    fontSize: 11
                  }}>
                    "{note.highlighted_text}"
                  </div>
                )}
                {note.content && (
                  <div style={{ color: '#333' }}>
                    {note.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Note Instructions */}
        <div style={{ marginTop: 20, padding: 10, borderTop: '1px solid #ddd', fontSize: 12, color: '#666' }}>
          <p><strong>How to add notes:</strong></p>
          <p>Right-click on the reader to access note options</p>
        </div>
      </div>

      <div className="reader-content">
        <div ref={viewerRef} className="epub-viewer">
          <div className="nav-buttons">
            <button className="prev-btn" onClick={handlePrev}>⟨</button>
            <button className="next-btn" onClick={handleNext}>⟩</button>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            padding: 8,
            zIndex: 1001,
            minWidth: 150
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid #eee'
            }}
            onClick={() => createNote('text')}
          >
            📝 Add Text Note
          </div>
          <div
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              color: contextMenu.selectedText ? '#000' : '#ccc'
            }}
            onClick={() => contextMenu.selectedText && createNote('highlight')}
          >
            🖍️ Highlight Text
            {!contextMenu.selectedText && <div style={{ fontSize: 10, color: '#999' }}>Select text first</div>}
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1002
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: 20,
            borderRadius: 8,
            width: 400,
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>Add Text Note</h3>
            
            {selectedText && (
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 'bold' }}>
                  Selected Text:
                </label>
                <div style={{
                  padding: 8,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 4,
                  fontSize: 12,
                  maxHeight: 100,
                  overflow: 'auto'
                }}>
                  "{selectedText}"
                </div>
              </div>
            )}

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5 }}>Note Content *</label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Enter your note content..."
                style={{
                  width: '100%',
                  height: 100,
                  padding: 8,
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5 }}>Color (optional)</label>
              <input
                type="color"
                value={noteColor}
                onChange={(e) => setNoteColor(e.target.value)}
                style={{ width: 50, height: 30 }}
              />
            </div>

            <div style={{ marginBottom: 15, fontSize: 12, color: '#666' }}>
              <div>Chapter: {currentChapter?.title}</div>
              <div>Page: {currentPageNumber}</div>
              {currentCfi && <div>CFI: {currentCfi}</div>}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteContent('');
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => submitNote('text', noteContent)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  backgroundColor: '#007bff',
                  color: 'white',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Results Panel */}
      {showAiPanel && (
        <div className="ai-panel" style={{ 
          position: 'fixed', 
          top: 0, 
          right: 0, 
          width: 400, 
          height: '100vh', 
          backgroundColor: 'white', 
          boxShadow: '-2px 0 10px rgba(0,0,0,0.1)', 
          padding: 20,
          overflowY: 'auto',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0 }}>
              {aiType === 'summary' && 'Summary'}
              {aiType === 'keywords' && 'Important Keywords'}
              {aiType === 'translation' && 'Translation'}
            </h3>
            <button 
              onClick={() => setShowAiPanel(false)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>

          {aiLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ marginBottom: 10 }}>Processing...</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                AI is analyzing the chapter content
              </div>
            </div>
          ) : aiResult ? (
            <div>
              {aiResult.error ? (
                <div style={{ color: 'red', padding: 10, backgroundColor: '#ffebee', borderRadius: 4 }}>
                  Error: {aiResult.error}
                </div>
              ) : (
                <div style={{ lineHeight: 1.6 }}>
                  {/* Display AI result fields */}
                  {aiType === 'summary' && (aiResult.summary || aiResult.data?.summary) && (
                    <div>
                      <h4>Summary:</h4>
                      <p>{aiResult.summary || aiResult.data?.summary}</p>
                    </div>
                  )}
                  {aiType === 'keywords' && (aiResult.keywords || aiResult.data?.keywords) && (
                    <div>
                      <h4>Important Keywords:</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {(aiResult.keywords || aiResult.data?.keywords || []).map((keyword, idx) => (
                          <span key={idx} style={{ 
                            padding: '4px 8px', 
                            backgroundColor: '#e3f2fd', 
                            borderRadius: 12, 
                            fontSize: 12 
                          }}>
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiType === 'translation' && (aiResult.translation || aiResult.data?.translation) && (
                    <div>
                      <h4>Translation:</h4>
                      <p>{aiResult.translation || aiResult.data?.translation}</p>
                    </div>
                  )}
                  {/* Show message if no AI data */}
                  {aiResult.message && !aiResult.summary && !aiResult.keywords && !aiResult.translation &&
                   !aiResult.data?.summary && !aiResult.data?.keywords && !aiResult.data?.translation && (
                    <div style={{ padding: 10, backgroundColor: '#e8f5e8', borderRadius: 4 }}>
                      {aiResult.message}
                    </div>
                  )}
                  {/* Fallback: show full result if nothing matches */}
                  {!aiResult.summary && !aiResult.keywords && !aiResult.translation && 
                   !aiResult.data?.summary && !aiResult.data?.keywords && !aiResult.data?.translation && 
                   !aiResult.message && (
                    <div>
                      <h4>Result:</h4>
                      <pre style={{ 
                        whiteSpace: 'pre-wrap', 
                        fontSize: 12, 
                        backgroundColor: '#f5f5f5', 
                        padding: 10, 
                        borderRadius: 4,
                        maxHeight: 400,
                        overflow: 'auto'
                      }}>
                        {JSON.stringify(aiResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default BookReader;