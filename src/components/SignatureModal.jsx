import { createElement, useState, useEffect, useRef, useCallback } from "react";
import "../ui/SignatureModal.css";

// Available signature fonts
const SIGNATURE_FONTS = [
    { name: "Segoe Script", family: "'Segoe Script', cursive" }, 
    { name: "Brush Script", family: "'Brush Script MT', cursive" },     // Windows
    { name: "Bradley Hand", family: "'Bradley Hand', cursive" },      // Mac
    { name: "Lucida Handwriting", family: "'Lucida Handwriting', cursive" },
    { name: "Cursive", family: "cursive" }  // Generic fallback
];

export default function SignatureModal({ isOpen, onClose, onApply, defaultName = "" }) {
    // Track which tab is selected
    const [activeTab, setActiveTab] = useState("style");
    
    // Full name and initials
    const [fullName, setFullName] = useState("");
    const [initials, setInitials] = useState("");
    
    // Selected font for signature
    const [selectedFontIndex, setSelectedFontIndex] = useState(0);
    
    // Show font picker
    const [showStylePicker, setShowStylePicker] = useState(false);
    
    // Canvas ref for draw tab
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawing, setHasDrawing] = useState(false);

    // Generate initials from full name
    const generateInitials = useCallback((name) => {
        if (!name) return "";
        const words = name.trim().split(/\s+/);
        if (words.length === 1) {
            return words[0].charAt(0).toUpperCase();
        }
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }, []);

    // Initialize with default name when modal opens
    useEffect(() => {
        if (isOpen && defaultName) {
            setFullName(defaultName);
            setInitials(generateInitials(defaultName));
        }
    }, [isOpen, defaultName, generateInitials]);

    // Update initials when name changes
    const handleNameChange = useCallback((e) => {
        const newName = e.target.value;
        setFullName(newName);
        // Auto-update initials based on new name
        setInitials(generateInitials(newName));
    }, [generateInitials]);

    // Setup canvas for drawing
    useEffect(() => {
        if (activeTab === "draw" && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            
            // Set canvas size
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            
            // Set drawing style
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
        }
    }, [activeTab]);

    // Canvas drawing functions
    const startDrawing = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    }, []);

    const draw = useCallback((e) => {
        if (!isDrawing) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
        
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasDrawing(true);
    }, [isDrawing]);

    const stopDrawing = useCallback(() => {
        setIsDrawing(false);
    }, []);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasDrawing(false);
        }
    }, []);

    // Handle apply signature
    const handleApply = useCallback(() => {
        let signatureData;
        
        if (activeTab === "draw" && hasDrawing) {
            // Get canvas as image
            signatureData = canvasRef.current.toDataURL("image/png");
        } else {
            // Create signature from text
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = 300;
            tempCanvas.height = 80;
            const ctx = tempCanvas.getContext("2d");
            
            // Clear background (transparent)
            ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Draw signature text
            ctx.font = `32px ${SIGNATURE_FONTS[selectedFontIndex].family}`;
            ctx.fillStyle = "#000";
            ctx.textBaseline = "middle";
            ctx.fillText(fullName, 10, 40);
            
            signatureData = tempCanvas.toDataURL("image/png");
        }
        
        onApply({
            signatureImage: signatureData,
            fullName: fullName,
            initials: initials,
            font: SIGNATURE_FONTS[selectedFontIndex].family,
            type: activeTab === "draw" ? "drawn" : "typed"
        });
    }, [activeTab, hasDrawing, fullName, initials, selectedFontIndex, onApply]);

    // Clear all fields
    const handleClear = useCallback(() => {
        if (activeTab === "draw") {
            clearCanvas();
        } else {
            setFullName("");
            setInitials("");
        }
    }, [activeTab, clearCanvas]);

    // Reset state when modal closes
    const handleClose = useCallback(() => {
        setActiveTab("style");
        setShowStylePicker(false);
        setHasDrawing(false);
        onClose();
    }, [onClose]);

    // Handle font selection
    const handleFontSelect = useCallback((index) => {
        setSelectedFontIndex(index);
        setShowStylePicker(false);
    }, []);

    // Toggle style picker
    const toggleStylePicker = useCallback(() => {
        setShowStylePicker(prev => !prev);
    }, []);

    if (!isOpen) return null;

    const currentFont = SIGNATURE_FONTS[selectedFontIndex];
    const canApply = activeTab === "draw" ? hasDrawing : fullName.trim().length > 0;

    return (
        <div className="signature-modal-overlay" onClick={handleClose}>
            <div className="signature-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="signature-modal-header">
                    <h3>Adopt Your Signature</h3>
                    <button onClick={handleClose} className="close-btn">✕</button>
                </div>

                {/* Name and Initials Inputs */}
                <div className="signature-inputs-section">
                    <p className="inputs-description">Confirm your name, initials, and signature.</p>
                    <div className="signature-inputs-row">
                        <div className="input-group">
                            <label className="input-label">
                                Full Name <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={handleNameChange}
                                className="signature-text-input"
                                placeholder="Enter your full name"
                            />
                        </div>
                        <div className="input-group initials-group">
                            <label className="input-label">
                                Initials <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                value={initials}
                                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                                className="signature-text-input initials-input"
                                placeholder="AA"
                                maxLength={4}
                            />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="signature-tabs">
                    <button
                        className={activeTab === "style" ? "tab active" : "tab"}
                        onClick={() => setActiveTab("style")}
                    >
                        SELECT STYLE
                    </button>
                    <button
                        className={activeTab === "draw" ? "tab active" : "tab"}
                        onClick={() => setActiveTab("draw")}
                    >
                        DRAW
                    </button>
                    {/* UPLOAD tab - commented out for now
                    <button
                        className={activeTab === "upload" ? "tab active" : "tab"}
                        onClick={() => setActiveTab("upload")}
                    >
                        UPLOAD
                    </button>
                    */}
                </div>

                {/* Content */}
                <div className="signature-content">
                    {activeTab === "style" && (
                        <div className="style-signature">
                            {/* Preview Header */}
                            <div className="preview-header">
                                <span className="preview-label">PREVIEW</span>
                                <button 
                                    className="change-style-btn"
                                    onClick={toggleStylePicker}
                                >
                                    Change Style
                                </button>
                            </div>

                            {/* Font Picker */}
                            {showStylePicker && (
                                <div className="font-picker">
                                    {SIGNATURE_FONTS.map((font, index) => (
                                        <button
                                            key={font.name}
                                            className={`font-option ${selectedFontIndex === index ? 'selected' : ''}`}
                                            onClick={() => handleFontSelect(index)}
                                        >
                                            <span style={{ fontFamily: font.family, fontSize: "24px" }}>
                                                {fullName || "Your Name"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Signature Preview */}
                            <div className="signature-preview-box">
                                <div className="preview-signature">
                                    <div className="preview-item">
                                        <span className="preview-item-label">Signed by:</span>
                                        <div className="signature-display" style={{ fontFamily: currentFont.family }}>
                                            {fullName || "Your signature"}
                                        </div>
                                        <span className="signature-id">Document Signer</span>
                                    </div>
                                    <div className="preview-item initials-preview">
                                        <span className="preview-item-label">Initials:</span>
                                        <div className="initials-display" style={{ fontFamily: currentFont.family }}>
                                            {initials || "AB"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "draw" && (
                        <div className="draw-signature">
                            <p className="draw-instruction">Draw your signature below</p>
                            <div className="canvas-container">
                                <canvas
                                    ref={canvasRef}
                                    className="signature-canvas"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                                {!hasDrawing && (
                                    <div className="canvas-placeholder">
                                        ✏️ Draw here
                                    </div>
                                )}
                            </div>
                            <button onClick={clearCanvas} className="clear-canvas-btn">
                                Clear Drawing
                            </button>
                        </div>
                    )}

                    {/* Upload tab - commented out
                    {activeTab === "upload" && (
                        <div className="upload-signature">
                            <p>Upload your signature image</p>
                        </div>
                    )}
                    */}
                </div>

                {/* Footer */}
                <div className="signature-modal-footer">
                    <button onClick={handleClear} className="clear-btn">
                        Clear
                    </button>
                    <button onClick={handleClose} className="cancel-btn">
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        className="apply-btn"
                        disabled={!canApply}
                    >
                        Adopt and Sign
                    </button>
                </div>
            </div>
        </div>
    );
}