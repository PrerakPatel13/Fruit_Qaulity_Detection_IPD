import React, { useState, useRef } from 'react';
import useDrivePicker from 'react-google-drive-picker';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
    // Google Drive Picker
    const [openPicker, authResponse] = useDrivePicker();
    
    const handleOpenPicker = () => {
        openPicker({
            clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
            developerKey: process.env.REACT_APP_GOOGLE_API_KEY,
            viewId: 'DOCS',
            showUploadView: true,
            showUploadFolders: true,
            supportDrives: true,
            multiselect: false,
            callbackFunction: async (data) => {
              if (data.action === 'picked') {
                  const selectedFiles = data.docs;
                  if (selectedFiles.length > 0) {
                      const selectedFile = selectedFiles[0];
                      console.log('Selected file from Google Drive:', selectedFile);
  
                      // Extract the file URL from the selected file
                      const fileUrl = selectedFile.url;
  
                      // Fetch the file content from the URL
                      const fileResponse = await fetch(fileUrl);
                      const fileBlob = await fileResponse.blob();
  
                      // Create a form data object and append the file blob
                      const formData = new FormData();
                      formData.append('image', fileBlob, selectedFile.name);
                      console.log(formData)
                      // Send the form data to the Ngrok endpoint
                      await predictImage(fileUrl);
                  }
              }
          },
      });
  };

    // Webcam and image capture
    const [cameraOn, setCameraOn] = useState(false);
    const [uploadedImageSrc, setUploadedImageSrc] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const labelContainerRef = useRef(null);

    const classNames = ['freshApples', 'freshBananas', 'freshOranges', 'rottenApples', 'rottenBananas', 'rottenOranges'];

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setCameraOn(true);
            }
        } catch (error) {
            console.error('Error accessing webcam:', error);
            toast.error('Error accessing webcam. Please try again.');
        }
    };

    const stopWebcam = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setCameraOn(false);
    };

    const captureImageFromWebcam = async () => {
        if (canvasRef.current && videoRef.current) {
            const context = canvasRef.current.getContext('2d');
            context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            const imageSrc = canvasRef.current.toDataURL('image/png');
            setUploadedImageSrc(imageSrc);

            const formData = new FormData();
            formData.append('image', dataURIToBlob(imageSrc));
            console.log(formData)
            await predictImage(formData);
        }
    };

    // File input and prediction
    const [selectedFile, setSelectedFile] = useState(null);

    const handleFileSelection = (event) => {
        const fileUploadControl = event.target;
        if (fileUploadControl.files.length > 0) {
            const file = fileUploadControl.files[0];
            setSelectedFile(file);
            setUploadedImageSrc(URL.createObjectURL(file));
        }
    };

    const handleLoadImage = async () => {
        if (!selectedFile) {
            toast.error('Please select an image file first.');
            return;
        }

        const formData = new FormData();
        formData.append('image', selectedFile);
        console.log(formData)
        await predictImage(formData);
    };

    const predictImage = async (formData) => {
        try {
            const response = await fetch(process.env.REACT_APP_PREDICTION_API_URL, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Prediction result:', data);

                const { className, percentage } = getClassWithHighestProbability(data.output, classNames);
                const grade = data.Grade || 'N/A';

                if (labelContainerRef.current) {
                    labelContainerRef.current.innerHTML = `
                        <p>Prediction: ${className}</p>
                        <p>Percentage: ${percentage}%</p>
                        <p>Grade: ${grade}</p>
                    `;
                }

                toast.success('Image successfully uploaded and prediction received.');
            } else {
                const errorText = await response.text();
                console.error(`Server error ${response.status}: ${response.statusText}. Response: ${errorText}`);
                toast.error(`Failed to load resource. Server error ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error sending image:', error);
            toast.error('Failed to send image. Please try again.');
        }
    };

    // Utility functions
    function getClassWithHighestProbability(output, classNames) {
        let maxProbability = Math.max(...output);
        let index = output.indexOf(maxProbability);
        let className = classNames[index];
        let percentage = (maxProbability).toFixed(2); // Convert to percentage and round to 2 decimal places

        return {
            className,
            percentage,
        };
    }

    function dataURIToBlob(dataURI) {
        const byteString = atob(dataURI.split(',')[1]);
        const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ia], { type: mimeString });
    }

    return (
        <div>
            <nav className="navbar navbar-dark" style={{ backgroundColor: '#000980' }}>
                <span className="navbar-brand title">Fruit Quality Detector</span>
            </nav>

            <div className="container" id="main">
                <div className="row justify-content-center">
                    <div className="col-lg-10 col-md-12">
                        <div className="card m-4">
                            <div className="card-body" id="box-cont">
                                <h3 className="card-title py-3 title" id="detect">
                                    Determine whether your fruit is fresh or rotten
                                </h3>
                                <p className="px-3">
                                    You can choose only <span className="yellow">Banana</span>, <span className="orange">Orange</span>, or{' '}
                                    <span className="red">Apple</span> for testing.
                                </p>
                                <p className="px-3">
                                    For doing so, you can either use your webcam and show the fruit or upload an image from your device.
                                </p>

                                {/* Google Drive Picker Button */}
                                <div className="px-3">
                                    <label htmlFor="googleDrivePicker" className="pt-3 pb-2 d-block">UPLOAD FROM GOOGLE DRIVE:</label>
                                    <button
                                        id="googleDrivePicker"
                                        type="button"
                                        className="btn btn-outline-primary mb-3"
                                        onClick={handleOpenPicker}
                                    >
                                        Choose from Google Drive
                                    </button>
                                </div>

                                {/* File input */}
                                <div className="px-3">
                                    <label htmlFor="fruitimg" className="pt-3 pb-2 d-block">UPLOAD IMAGE:</label>
                                    <div className="input-group mb-3" id="inputimg">
                                        <input
                                            type="file"
                                            className="form-control"
                                            accept="image/*"
                                            id="fruitimg"
                                            onChange={handleFileSelection}
                                        />
                                        <button className="btn btn-outline-primary" id="loadBtn" onClick={handleLoadImage}>
                                            Load
                                        </button>
                                    </div>
                                </div>

                                {/* Webcam */}
                                <div className="px-3 mt-3">
                                    <label htmlFor="webcam" className="d-block">USE WEBCAM:</label>
                                    <button
                                        id="webcam"
                                        type="button"
                                        className="btn btn-outline-primary me-3"
                                        onClick={cameraOn ? stopWebcam : startWebcam}
                                    >
                                        {cameraOn ? 'Close Webcam' : 'Start Webcam'}
                                    </button>
                                    {cameraOn && (
                                        <button className="btn btn-outline-success ms-2" onClick={captureImageFromWebcam}>
                                            Capture
                                        </button>
                                    )}
                                    <div id="webcam-container" className="mt-3">
                                        <video ref={videoRef} width="100%" height="auto" autoPlay />
                                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                                    </div>
                                </div>

                                {/* Display uploaded image */}
                                <div id="uploadedImage" className="mt-3">
                                    {uploadedImageSrc && <img src={uploadedImageSrc} alt="Uploaded" width="100%" />}
                                </div>

                                {/* Prediction result */}
                                <div id="label-container" className="px-3 pt-3" ref={labelContainerRef}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ToastContainer />
        </div>
    );
}

export default App;
