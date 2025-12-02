import { createElement, useCallback, useEffect, useState, useRef } from "react";
import DocumentViewer from "./components/DocumentViewer";
import { downloadFromS3 } from "./utils/s3-downloader";
import "./ui/DocumentSigner.css";

// Global counter for widget instances (like PDF Annotations)
let globalWidgetCounter = 0;

export default function DocumentSigner(props) {
    const [pdfUrl, setPdfUrl] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [loadingStatus, setLoadingStatus] = useState("Initializing widget...");
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [debugInfo, setDebugInfo] = useState([]);
    const [droppedFields, setDroppedFields] = useState([])

    // Unique widget instance ID for isolation (like PDF Annotations)
    const [widgetInstanceId] = useState(() => {
        globalWidgetCounter++;
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substr(2, 16);
        const counterPart = globalWidgetCounter.toString().padStart(6, '0');
        return `doc-signer-${counterPart}-${timestamp}-${randomPart}`;
    });

    // Track previous blob URL for cleanup
    const previousBlobUrl = useRef(null);

    // Debug logging function (like PDF Annotations)
    const addDebugLog = useCallback((message) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] [Widget ${widgetInstanceId}] ${message}`;
        console.log(logEntry);
        setDebugInfo(prev => {
            // Limit debug log size to prevent memory issues
            const newLogs = [...prev, logEntry];
            return newLogs.slice(-100); // Keep last 100 entries
        });
    }, [widgetInstanceId]);

    // Widget mount/unmount logging
    useEffect(() => {
        addDebugLog("🚀 DocumentSigner Widget initialized");
        return () => {
            addDebugLog("🔥 DocumentSigner Widget unmounted");
        };
    }, [addDebugLog]);

    // Validate PDF blob before displaying (like PDF Annotations)
    const validatePdfBlob = useCallback(async (pdfBlob) => {
        try {
            const arrayBuffer = await pdfBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Check PDF signature (%PDF)
            const pdfSignature = "%PDF";
            const header = new TextDecoder().decode(uint8Array.slice(0, 4));
            
            if (header === pdfSignature) {
                addDebugLog("✅ PDF validation successful");
                return true;
            } else {
                addDebugLog(`⚠️ PDF validation failed - Invalid header: ${header}`);
                return false;
            }
        } catch (error) {
            addDebugLog(`⚠️ PDF validation error: ${error.message}`);
            return false;
        }
    }, [addDebugLog]);

    // Function to download the S3 file (enhanced like PDF Annotations)
    const downloadPdfFromS3 = useCallback(async (awsConfig) => {
        setIsLoading(true);
        setError("");
        setDownloadProgress(0);
        setLoadingStatus("Initializing document downloader...");
        
        try {
            addDebugLog("🚀 Starting PDF download from S3...");
            addDebugLog(`📁 File: ${awsConfig.fileName}`);
            addDebugLog(`🪣 Bucket: ${awsConfig.bucketName}`);
            addDebugLog(`🌍 Region: ${awsConfig.region}`);

            setLoadingStatus("Downloading PDF file...");

            const result = await downloadFromS3(
                {
                    accessKey: awsConfig.accessKeyId,
                    secretKey: awsConfig.secretAccessKey,
                    region: awsConfig.region
                },
                awsConfig.bucketName,
                awsConfig.fileName,
                (progress, status, presignedUrl) => {
                    setDownloadProgress(Math.min(progress, 90)); // Cap at 90% until validation
                    setLoadingStatus(status);
                    
                    if (progress % 20 === 0 || progress === 100) {
                        addDebugLog(`📊 Download progress: ${progress}% - ${status}`);
                    }
                }
            );

            addDebugLog(`✅ File downloaded - Size: ${result.size} bytes, Type: ${result.contentType}`);

            // Create PDF blob
            setLoadingStatus("Preparing PDF for display...");
            setDownloadProgress(92);

            const pdfBlob = new Blob([result.buffer], { type: 'application/pdf' });
            addDebugLog(`📄 Created PDF Blob: ${pdfBlob.size} bytes`);

            // Validate PDF before displaying (like PDF Annotations)
            setLoadingStatus("Validating PDF...");
            setDownloadProgress(95);
            
            const isValidPdf = await validatePdfBlob(pdfBlob);
            if (!isValidPdf) {
                addDebugLog("⚠️ PDF validation failed, but proceeding anyway");
            }

            // Revoke previous blob URL if exists
            if (previousBlobUrl.current) {
                URL.revokeObjectURL(previousBlobUrl.current);
                addDebugLog("🧹 Revoked previous blob URL");
            }

            // Create new blob URL
            const pdfBlobUrl = URL.createObjectURL(pdfBlob);
            previousBlobUrl.current = pdfBlobUrl;
            
            addDebugLog(`🔗 New blob URL created: ${pdfBlobUrl.substring(0, 50)}...`);

            setPdfUrl(pdfBlobUrl);
            setError("");
            setIsLoading(false);
            setDownloadProgress(100);
            setLoadingStatus("Document ready!");
            
            addDebugLog("🎉 Document ready for viewing!");

        } catch (err) {
            addDebugLog(`❌ Download failed: ${err.message}`);
            console.error("Download Failed:", err);
            
            // Enhanced error handling (like PDF Annotations)
            let userFriendlyError = `Failed to load document: ${err.message}`;
            let troubleshootingSteps = [];
            
            if (err.message.includes('Access denied') || err.message.includes('403')) {
                userFriendlyError = `Access denied to S3 bucket '${awsConfig.bucketName}'`;
                troubleshootingSteps = [
                    "Verify IAM permissions for s3:GetObject",
                    "Check bucket policy allows access",
                    "Ensure bucket and file exist",
                    "Verify CORS configuration on S3 bucket"
                ];
            } else if (err.message.includes('not found') || err.message.includes('404')) {
                userFriendlyError = `File '${awsConfig.fileName}' not found in bucket`;
                troubleshootingSteps = [
                    "Verify the file exists in the S3 bucket",
                    "Check the file path is correct",
                    "Ensure you're using the right bucket"
                ];
            } else if (err.message.includes('Network') || err.message.includes('fetch')) {
                userFriendlyError = "Network error: Cannot connect to AWS S3";
                troubleshootingSteps = [
                    "Check your internet connection",
                    "Verify AWS region is correct",
                    "Try again in a few minutes"
                ];
            }
            
            setError({ message: userFriendlyError, steps: troubleshootingSteps });
            setIsLoading(false);
            setDownloadProgress(0);
        }
    }, [addDebugLog, validatePdfBlob]);

    // Check props and trigger download (like PDF Annotations)
    useEffect(() => {
        addDebugLog("🔧 Checking configuration...");
        addDebugLog(`Props status - AccessKey: ${props.awsAccessKey?.status}, SecretKey: ${props.awsSecretKey?.status}, Region: ${props.awsRegion?.status}, Bucket: ${props.s3BucketName?.status}, File: ${props.fileName?.status}`);

        const isConfigReady =
            props.awsAccessKey?.status === "available" && props.awsAccessKey?.value &&
            props.awsSecretKey?.status === "available" && props.awsSecretKey?.value &&
            props.awsRegion?.status === "available" && props.awsRegion?.value &&
            props.s3BucketName?.status === "available" && props.s3BucketName?.value &&
            props.fileName?.status === "available" && props.fileName?.value;

        if (isConfigReady) {
            const awsConfig = {
                accessKeyId: props.awsAccessKey.value.trim(),
                secretAccessKey: props.awsSecretKey.value.trim(),
                region: props.awsRegion.value.trim(),
                bucketName: props.s3BucketName.value.trim(),
                fileName: props.fileName.value.trim()
            };

            addDebugLog(`🔑 AWS Config ready - Region: ${awsConfig.region}, Bucket: ${awsConfig.bucketName}, File: ${awsConfig.fileName}`);
            downloadPdfFromS3(awsConfig);
        } else {
            const isStillLoading =
                props.awsAccessKey?.status === "loading" ||
                props.awsSecretKey?.status === "loading" ||
                props.awsRegion?.status === "loading" ||
                props.s3BucketName?.status === "loading" ||
                props.fileName?.status === "loading";

            if (isStillLoading) {
                addDebugLog("🔑 Configuration still loading...");
                setLoadingStatus("Loading configuration...");
                setIsLoading(true);
                setError("");
            } else {
                addDebugLog("❌ Configuration incomplete");
                setError({ 
                    message: "Configuration incomplete. Please check all required fields are provided.",
                    steps: [
                        "Ensure AWS Access Key is provided",
                        "Ensure AWS Secret Key is provided",
                        "Ensure AWS Region is provided",
                        "Ensure S3 Bucket Name is provided",
                        "Ensure File Name is provided"
                    ]
                });
                setIsLoading(false);
            }
        }
    }, [props.awsAccessKey, props.awsSecretKey, props.awsRegion, props.s3BucketName, props.fileName, downloadPdfFromS3, addDebugLog]);

    // Cleanup blob URL on unmount
    useEffect(() => {
        return () => {
            if (pdfUrl && pdfUrl.startsWith('blob:')) {
                URL.revokeObjectURL(pdfUrl);
                addDebugLog("🧹 Cleaned up blob URL on unmount");
            }
        };
    }, [pdfUrl, addDebugLog]);

    //Function to trigger when the user drops the field
    const handleFieldDrop = (fieldType, position) => {
        let labelValue;
        console.info(props.userName?.value || "No user Name")
        console.info(props.currentDate?.value || "No Current Date")
        if (fieldType === "name" && props.userName?.value) {
            labelValue = props.userName.value
        }
        if (fieldType === "date" && props.currentDate?.value) {
            labelValue = props.currentDate.value
        }
        if (fieldType === "signature" && props.userName?.value) {
            labelValue = `Signed by ${props.userName.value}`;
        }
        const newField = {
            id: crypto.randomUUID(),
            type: fieldType,
            page: position.page,
            xPercent: position.xPercent,
            yPercent: position.yPercent,
            value: labelValue
        };

        setDroppedFields(prev => [...prev, newField])
    };

    //Function to remove the Field
    const removeField = (id) => {
        setDroppedFields(prev => prev.filter(field => field.id !== id));
    }

    // Loading state (enhanced like PDF Annotations)
    if (isLoading) {
        return (
            <div className="document-signer-loading">
                <div className="loading-spinner"></div>
                <div className="loading-status-info">
                    <h3 className="loading-title">Loading Document</h3>
                    <p className="loading-status-text">{loadingStatus}</p>
                    
                    {downloadProgress > 0 && (
                        <div className="progress-container">
                            <div className="progress-bar-background">
                                <div 
                                    className="progress-bar" 
                                    style={{ width: `${downloadProgress}%` }}
                                ></div>
                            </div>
                            <span className="progress-text">{downloadProgress}% complete</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Error state (enhanced like PDF Annotations)
    if (error) {
        return (
            <div className="document-signer-error">
                <div className="error-content">
                    <div className="error-icon">⚠️</div>
                    <h3 className="error-title">Document Load Failed</h3>
                    <p className="error-message">
                        {typeof error === 'string' ? error : error.message}
                    </p>
                    
                    {error.steps && error.steps.length > 0 && (
                        <div className="troubleshooting-section">
                            <h4 className="troubleshooting-title">🔧 Troubleshooting Steps:</h4>
                            <ul className="troubleshooting-list">
                                {error.steps.map((step, index) => (
                                    <li key={index} className="troubleshooting-item">{step}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // No PDF URL yet
    if (!pdfUrl) {
        return (
            <div className="document-signer-empty">
                <div className="empty-icon">📄</div>
                <h3 className="empty-title">Document Signer Ready</h3>
                <p className="empty-message">Waiting for document from Mendix...</p>
            </div>
        );
    }


    // Success - render DocumentViewer
    return (
        <div className="document-signer" data-widget-instance={widgetInstanceId}>
            <div className="signer-layout">
                <div className="left-pdf-viewer">
                    <DocumentViewer 
                        pdfUrl={pdfUrl} 
                        widgetInstanceId={widgetInstanceId}
                        onFieldDrop={handleFieldDrop}
                        droppedFields={droppedFields}
                        removeField={removeField}
                    />
                </div>
                <div className="right-field-pannel">
                    <h3>Add Fields</h3>
                    <div className="field-name" draggable onDragStart={(e) => e.dataTransfer.setData("fieldType", "name")}>
                        Name Field
                    </div>
                    <div className="field-name" draggable onDragStart={(e) => e.dataTransfer.setData("fieldType", "date")}>
                        Date Field
                    </div>
                    <div className="field-name" draggable onDragStart={(e) => e.dataTransfer.setData("fieldType", "signature")}>
                        Signature Field
                    </div>
                </div>
            </div>
        </div>
    );
}