import { createElement, useState } from "react";
import "../ui/SignatureModal.css"

export default function SignatureModal({ isOpen, onClose, onApply}) {
    //Track which tab is selected
    const [activeTab, setActiveTab] = useState("type");
    //store typed Name
    const [typedName, setTypedName] = useState("");

    if (!isOpen) return null;

    return(
        <div className="signature-modal-overlay">
            <div className="signature-modal">
                {/**Header*/}
                <div className="signature-modal-header">
                    <h3>Create Your Signature</h3>
                    <button onClick={onClose} className="close-btn">✕</button>
                </div>
                {/** Tabs */}
                <div className="signature-tabs">
                    <button 
                      className={activeTab === "draw" ? "tab active" : "tab"}
                      onClick={() => setActiveTab("draw")}
                    >
                    ✏️ Draw
                    </button>
                    <button
                      className={activeTab === "type" ? "tab active" : "tab"}
                      onClick={() => setActiveTab("type")}
                    >
                    ⌨️ Type
                    </button>
                    {/* <button
                      className={activeTab === "uplaod" ? "tab active" : "tab"}
                      onClick={()=> setActiveTab("upload")}
                    >
                    📤 Upload
                    </button> */}
                </div>
                {/** Content changes based on the tab */}
                <div className="signature-content">
                    {activeTab === "type" && (
                        <div className="type-signature">
                            <input
                              type="text"
                              placeholder="Type your Name"
                              value={typedName}
                              onChange={(e) => setTypedName(e.target.value)}
                              className="signature-input"
                            />
                            {/** Preview in cursive font */}
                            <div className="signature-preview">
                                <p style={{ fontFamily: "'Dancing Script', cursive", fontSize: "32px" }} >
                                    {typedName || 'Your signature'}
                                </p>
                            </div>
                        </div>
                    )}
                    {activeTab === "draw" && (
                        <div className="draw-signature">
                            <p>Draw tab - we'll build this next</p>
                        </div>
                    )}
                    {activeTab === "upload" && (
                        <div className="upload-signature">
                            <p>Upload tab - we'll build this later</p>
                        </div>
                    )}
                </div>
                {/** Footer */}
                <div className="signature-modal-footer">
                    <button onClick={() => setTypedName("")} className="clear-btn">
                        Clear
                    </button>
                    <button onClick={onClose} className="cancel-btn">
                        Cancel
                    </button>
                    <button 
                        onClick={() => onApply(typedName)} 
                        className="apply-btn"
                        disabled={!typedName}
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    )
}