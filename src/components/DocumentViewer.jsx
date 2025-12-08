// DocumentViewer.jsx - Enhanced PDF Viewer Component (OPTIMIZED)
// Using react-pdf library with robust loading like PDF Annotations widget

import { createElement, useCallback, useState, useEffect, useMemo, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import '../ui/DocumentViewer.css';

// PDF.js worker setup
console.log('🔧 PDF.js version from react-pdf:', pdfjs.version);
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function DocumentViewer({ pdfUrl, widgetInstanceId, onFieldDrop, droppedFields, removeField, onSignatureApply, defaultUserName, onFieldValueChange, onFieldReposition }) {
    const [isLoading, setIsLoading] = useState(true);
    const [numPages, setNumPages] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [error, setError] = useState(null);
    const [loadMethod, setLoadMethod] = useState('direct');
    const [processedPdfSource, setProcessedPdfSource] = useState(null);
    const [isPreparingSource, setIsPreparingSource] = useState(false);
    const [isCanvasReady, setIsCanvasReady] = useState(false);

    // Ref for throttling reposition
    const repositionTimeoutRef = useRef(null);

    // Document options (memoized like PDF Annotations)
    const documentOptions = useMemo(() => ({
        workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
        verbosity: 1,
        httpHeaders: {
            'Accept': 'application/pdf,*/*',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        },
        withCredentials: false,
        timeout: 120000,
        disableAutoFetch: false,
        disableStream: false,
        disableRange: false,
        useSystemFonts: true,
        fontExtraProperties: true,
        stopAtErrors: false,
        isEvalSupported: false,
        password: null,
        disableCreateObjectURL: false,
        maxImageSize: 1024 * 1024 * 10,
        enableXfa: false,
        enableWebGL: false,
        isOffscreenCanvasSupported: false,
        pdfBug: false
    }), []);

    // Cleanup reposition timeout on unmount
    useEffect(() => {
        return () => {
            if (repositionTimeoutRef.current) {
                clearTimeout(repositionTimeoutRef.current);
            }
        };
    }, []);
    
    // This function is called when Dragging Over PDF page
    const handleDragOver = useCallback((e) => {
        e.preventDefault(); // Must allow dropping
    }, []);

    // This function is called when Dropping on PDF page (OPTIMIZED with throttle)
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        
        const rect = e.currentTarget.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
        
        // Check if repositioning existing field
        const dragFieldId = e.dataTransfer.getData("dragFieldId");
        if (dragFieldId) {
            // Throttle reposition updates to prevent rapid state changes
            if (repositionTimeoutRef.current) {
                clearTimeout(repositionTimeoutRef.current);
            }
            repositionTimeoutRef.current = setTimeout(() => {
                onFieldReposition(dragFieldId, { xPercent, yPercent, page: currentPage });
            }, 50); // Small delay to batch rapid updates
            return;
        }
        
        // New field drop (existing code)
        const fieldType = e.dataTransfer.getData("fieldType");
        if (!fieldType) return;
        onFieldDrop(fieldType, { xPercent, yPercent, page: currentPage });
    }, [onFieldDrop, onFieldReposition, currentPage]);

    // PDF loading strategies (like PDF Annotations)
    const createPDFSource = useCallback((url, method) => {
        switch (method) {
            case 'direct':
                return Promise.resolve(url);
                
            case 'fetch':
                return fetch(url, {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Accept': 'application/pdf,*/*',
                        'Content-Type': 'application/pdf'
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.blob();
                })
                .then(blob => {
                    const pdfBlob = new Blob([blob], { type: 'application/pdf' });
                    return URL.createObjectURL(pdfBlob);
                });
                
            case 'arraybuffer':
                return fetch(url, {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache'
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.arrayBuffer();
                })
                .then(buffer => ({ data: buffer }));
                
            default:
                return Promise.resolve(url);
        }
    }, []);

    // Create PDF source based on current method
    useEffect(() => {
        if (!pdfUrl) {
            setProcessedPdfSource(null);
            return;
        }

        setIsPreparingSource(true);
        setIsCanvasReady(false);

        const preparePDFSource = async () => {
            try {
                console.log(`[DocumentViewer] Preparing PDF source with method: ${loadMethod}`);
                const source = await createPDFSource(pdfUrl, loadMethod);
                setProcessedPdfSource(source);
                setIsPreparingSource(false);
            } catch (error) {
                console.error('[DocumentViewer] Error preparing PDF source:', error);
                setProcessedPdfSource(pdfUrl);
                setIsPreparingSource(false);
            }
        };

        preparePDFSource();
    }, [pdfUrl, loadMethod, createPDFSource]);

    // Handle successful PDF load
    const handleLoadSuccess = useCallback(({ numPages }) => {
        console.log(`✅ [DocumentViewer] PDF loaded successfully with ${numPages} pages`);
        setNumPages(numPages);
        setIsLoading(false);
        setError(null);
    }, []);

    // Handle page render success
    const handlePageRenderSuccess = useCallback(() => {
        setIsCanvasReady(true);
        console.log('[DocumentViewer] Canvas rendered successfully');
    }, []);

    // Enhanced error handler with method fallback (like PDF Annotations)
    const handleLoadError = useCallback((error) => {
        console.error(`❌ [DocumentViewer] PDF loading error:`, error);
        
        const loadMethods = ['direct', 'fetch', 'arraybuffer'];
        const currentMethodIndex = loadMethods.indexOf(loadMethod);
        
        // Try next loading method if available
        if (currentMethodIndex < loadMethods.length - 1) {
            const nextMethod = loadMethods[currentMethodIndex + 1];
            console.log(`🔄 [DocumentViewer] Trying fallback method: ${nextMethod}`);
            setLoadMethod(nextMethod);
            setError(null);
            setIsLoading(true);
            setProcessedPdfSource(null);
            setIsPreparingSource(false);
            return;
        }
        
        // All methods failed - show error
        let userFriendlyError = 'Failed to load PDF with all methods';
        let troubleshootingTips = [];
        
        if (error.message) {
            const errorMsg = error.message.toLowerCase();
            
            if (errorMsg.includes('load failed') || errorMsg.includes('network')) {
                userFriendlyError = 'Network or CORS error loading PDF';
                troubleshootingTips = [
                    'The PDF server may not allow cross-origin requests',
                    'Try uploading the PDF to your Mendix app instead of using external URLs',
                    'Check if your network/firewall is blocking the PDF URL',
                    'Contact your system administrator about CORS policies'
                ];
            } else if (errorMsg.includes('format') || errorMsg.includes('invalid')) {
                userFriendlyError = 'Invalid or corrupted PDF file';
                troubleshootingTips = [
                    'Verify the file is a valid PDF document',
                    'Try opening the PDF URL directly in your browser',
                    'Check if the PDF requires a password',
                    'Try with a different PDF file to test the widget'
                ];
            }
        }
        
        setError({
            message: userFriendlyError,
            technical: error.message || 'Unknown error',
            tips: troubleshootingTips,
            methodsAttempted: currentMethodIndex + 1,
            totalMethods: loadMethods.length
        });
        setIsLoading(false);
    }, [loadMethod]);

    // Handle page changes
    const handlePageChange = useCallback((pageNumber) => {
        if (pageNumber >= 1 && pageNumber <= numPages) {
            setCurrentPage(pageNumber);
            setIsCanvasReady(false); // Reset canvas ready state for new page
        }
    }, [numPages]);

    // Zoom functions
    const zoomIn = useCallback(() => {
        setIsCanvasReady(false);
        setScale(prev => Math.min(prev + 0.2, 2.0));
    }, []);

    const zoomOut = useCallback(() => {
        setIsCanvasReady(false);
        setScale(prev => Math.max(prev - 0.2, 0.5));
    }, []);

    const zoomReset = useCallback(() => {
        setIsCanvasReady(false);
        setScale(1.0);
    }, []);

    // Memoize filtered fields for current page to prevent unnecessary re-renders
    const currentPageFields = useMemo(() => {
        return droppedFields.filter(field => field.page === currentPage);
    }, [droppedFields, currentPage]);

    // Initial loading state
    if (!pdfUrl) {
        return (
            <div className="document-viewer-empty">
                <div className="empty-icon">📄</div>
                <h3>Document Viewer Ready</h3>
                <p>Waiting for PDF URL...</p>
            </div>
        );
    }

    // Loading overlay when preparing source or canvas not ready
    const showLoadingOverlay = isLoading || isPreparingSource || !isCanvasReady;

    return (
        <div className="document-viewer" data-widget-instance={widgetInstanceId}>
            {/* Toolbar */}
            <div className="document-toolbar">
                {/* Zoom Controls */}
                <div className="toolbar-section zoom-controls">
                    <button
                        onClick={zoomOut}
                        disabled={scale <= 0.5}
                        className="toolbar-button"
                        title="Zoom Out"
                    >
                        −
                    </button>

                    <span className="zoom-info">
                        {Math.round(scale * 100)}%
                    </span>
                    
                    <button
                        onClick={zoomIn}
                        disabled={scale >= 2.0}
                        className="toolbar-button"
                        title="Zoom In"
                    >
                        +
                    </button>

                    <button
                        onClick={zoomReset}
                        disabled={scale === 1.0}
                        className="toolbar-button"
                        title="Reset Zoom"
                    >
                        Reset Zoom
                    </button>
                </div>
                {/* Page Navigation */}
                <div className="toolbar-section page-navigation">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="toolbar-button"
                        title="Previous Page"
                    >
                        ◀ Prev
                    </button>

                    <span className="page-info">
                        Page {currentPage} of {numPages || '...'}
                    </span>
                    
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= numPages}
                        className="toolbar-button"
                        title="Next Page"
                    >
                        Next ▶
                    </button>
                </div>
            </div>

            {/* PDF Container */}
            <div className="pdf-container">
                {/* Loading Overlay */}
                {showLoadingOverlay && (
                    <div className="loading-overlay">
                        <div className="loading-spinner"></div>
                        <div className="loading-text">
                            <div className="loading-message">
                                {isPreparingSource ? `Preparing PDF (${loadMethod})...` : 
                                 !isCanvasReady ? 'Rendering page...' : 
                                 'Loading PDF...'}
                            </div>
                        </div>
                    </div>
                )}

                {/* PDF Document */}
                {processedPdfSource ? (
                    <div className="pdf-page-wrapper">
                        <div className="pdf-drop-zone" onDragOver={handleDragOver} onDrop={handleDrop}>
                            <Document
                                file={processedPdfSource}
                                onLoadSuccess={handleLoadSuccess}
                                onLoadError={handleLoadError}
                                options={documentOptions}
                                loading={
                                    <div className="page-loading">
                                        <div className="loading-spinner"></div>
                                        <p>Loading Document...</p>
                                    </div>
                                }
                            >
                                <Page
                                    pageNumber={currentPage}
                                    scale={scale}
                                    renderAnnotationLayer={false}
                                    renderTextLayer={false}
                                    onRenderSuccess={handlePageRenderSuccess}
                                    loading={
                                        <div className="page-loading">
                                            <p>Loading page {currentPage}...</p>
                                        </div>
                                    }
                                />
                            </Document>
                            
                            {/* Render dropped fields - using memoized currentPageFields */}
                            {currentPageFields.map(field => (
                                <div 
                                    key={field.id}
                                    className={`pdf-field-placeholder ${field.type}-field`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData("dragFieldId", field.id);
                                    }}
                                    style={{
                                        position: 'absolute',
                                        left: `${field.xPercent}%`,
                                        top: `${field.yPercent}%`,
                                        transform: `translate(-50%, -50%) scale(${scale})`,
                                        transformOrigin: 'center center',
                                        zIndex: 100,
                                    }}
                                >
                                    {/* Signature field with image */}
                                    {field.type === "signature" ? (
                                        field.signatureData ? (
                                            // Signed Signature
                                            <div className="signature-field-content signed">
                                                <img 
                                                    src={field.signatureData} 
                                                    alt="Signature" 
                                                    className="signature-image"
                                                />
                                            </div>
                                        ) : (
                                            // Signature Placeholder
                                            <div className="signature-field-content unsigned">
                                                <span>📝 Signature pending...</span>
                                            </div>
                                        )
                                    ) : field.type === "name" ? (
                                        // Editable Name
                                        <input
                                            type="text"
                                            className="field-value-input"
                                            value={field.value || ""}
                                            onChange={(e) => onFieldValueChange(field.id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        // Default → date or any other text field
                                        <div className="text-field-content">
                                            <span className="field-value">{field.value}</span>
                                        </div>
                                    )}

                                    {/* Remove button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeField(field.id);
                                        }}
                                        className="remove-field-btn"
                                        title="Remove field"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="preparing-container">
                        <div className="loading-spinner"></div>
                        <p>Preparing PDF source...</p>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="document-viewer-error">
                        <div className="error-icon">⚠️</div>
                        <h3>Failed to Load PDF</h3>
                        <p className="error-message">{error.message}</p>
                        
                        {error.tips && error.tips.length > 0 && (
                            <div className="troubleshooting-section">
                                <h4>🔧 Troubleshooting Tips:</h4>
                                <ul>
                                    {error.tips.map((tip, index) => (
                                        <li key={index}>{tip}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        {error.methodsAttempted && (
                            <p className="methods-info">
                                Tried {error.methodsAttempted} of {error.totalMethods} loading methods
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}