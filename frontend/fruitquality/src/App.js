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
            multiselect: true, // Allow multiple file selection
            callbackFunction: async (data) => {
                if (data.action === 'picked') {
                    const selectedFiles = data.docs;
                    if (selectedFiles.length > 0) {
                        const fileUrls = selectedFiles.map(file => file.url);

                        // Process each file one by one
                        for (const fileUrl of fileUrls) {
                            // Fetch the file content from the URL
                            const fileResponse = await fetch(fileUrl);
                            const fileBlob = await fileResponse.blob();

                            // Create a form data object and append the file blob
                            const formData = new FormData();
                            formData.append('files', fileBlob);

                            // Send the form data to the prediction API
                            await predictImage(formData);
                        }
                    }
                }
            },
        });
    };

    // Webcam and image capture
    const [cameraOn, setCameraOn] = useState(false);
    const [uploadedImageSrcs, setUploadedImageSrcs] = useState([]);
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
            setUploadedImageSrcs([...uploadedImageSrcs, imageSrc]);

            const formData = new FormData();
            formData.append('files', dataURIToBlob(imageSrc));
            await predictImage(formData);
        }
    };

    // File input and prediction
    const [selectedFiles, setSelectedFiles] = useState([]);

    const handleFileSelection = (event) => {
        const fileUploadControl = event.target;
        const files = Array.from(fileUploadControl.files); // Convert FileList to Array
    
        if (files.length > 0) {
            // Reset the state variables to clear previous images and files
            setSelectedFiles(files);
            
            // Reset uploadedImageSrcs state and create an array of new image URLs to display
            const newImageUrls = files.map(file => URL.createObjectURL(file));
            setUploadedImageSrcs(newImageUrls);
        }
    };
    

    const handleLoadImage = async () => {
        if (selectedFiles.length === 0) {
            toast.error('Please select image files first.');
            return;
        }
    
        // Create a single FormData object and append all selected files
        const formData = new FormData();
        selectedFiles.forEach((file) => {
            formData.append('files', file); // Use 'images' as the field name (adjust as per your API)
        });
    
        try {
            // Call the API with the formData containing all files
            await predictImage(formData);
        } catch (error) {
            console.error('Failed to predict images:', error);
            toast.error('Failed to predict images. Please try again.');
        }
    };
    const calculateOverallResultAndGrade = (results, grades, outputs) => {
        // Calculate overall final result and grade based on the individual results and grades
        
        // Calculate the most common result
        const resultFrequency = {};
        results.forEach(result => {
            resultFrequency[result] = (resultFrequency[result] || 0) + 1;
        });
        
        // Find the result with the highest frequency (most common result)
        let overallFinalResult = null;
        let maxFrequency = 0;
        for (const [result, frequency] of Object.entries(resultFrequency)) {
            if (frequency > maxFrequency) {
                overallFinalResult = result;
                maxFrequency = frequency;
            }
        }
        
        // Calculate the overall final grade
        // Here, we take the lowest grade as the overall grade.
        // You may adjust this based on your application's requirements.
        const overallFinalGrade = grades.reduce((acc, grade) => {
            return acc > grade ? grade : acc;
        }, grades[0]);
        
        // Calculate the overall final percentage
        // Calculate the average output percentage
        const totalOutput = outputs.reduce((sum, output) => sum + output, 0);
        const overallFinalPercentage = (totalOutput / outputs.length).toFixed(2); // Rounded to 2 decimal places
        
        return { overallFinalResult, overallFinalGrade, overallFinalPercentage };
    };
    
    const predictImage = async (formData) => {
        try {
            // Log the form data before sending
            console.log('FormData before sending:', [...formData.entries()]);
        
            // Make the API call with the formData containing all files
            const response = await fetch(process.env.REACT_APP_PREDICTION_API_URL, {
                method: 'POST',
                body: formData,
            });
    
            if (response.ok) {
                const data = await response.json();
                console.log('Prediction result:', data);
        
                // Handle the prediction results for each image
                const finalResults = data.result;
                const finalGrades = data.Grade;
                const outputs = data.output;
        
                // Display individual results, grades, and percentages
                let resultHTML = '<p>Prediction Results:</p>';
                finalResults.forEach((result, index) => {
                    const grade = finalGrades[index];
                    const output = outputs[index];
                    const percentage = (output).toFixed(2); // Convert output to percentage and round to 2 decimal places
        
                    resultHTML += `
                        <p>Image ${index + 1}:</p>
                        <p>Final Result: ${result}</p>
                        <p>Final Grade: ${grade}</p>
                        <p>Percentage: ${percentage}%</p>
                        <hr>
                    `;
                });
        
                // Calculate overall final result, grade, and percentage
                const { overallFinalResult, overallFinalGrade, overallFinalPercentage } = calculateOverallResultAndGrade(finalResults, finalGrades, outputs);
        
                // Add overall final result, grade, and percentage to the HTML
                resultHTML += `
                    <p>Overall Final Result: ${overallFinalResult}</p>
                    <p>Overall Final Grade: ${overallFinalGrade}</p>
                    <p>Overall Final Percentage: ${overallFinalPercentage}%</p>
                `;
        
                // Display the results
                if (labelContainerRef.current) {
                    labelContainerRef.current.innerHTML = resultHTML;
                }
        
                toast.success('Images successfully uploaded and prediction received.');
            } else {
                // Handle server errors and provide specific feedback
                const errorText = await response.text();
                console.error(`Server error ${response.status}: ${response.statusText}. Response: ${errorText}`);
                toast.error(`Failed to load resource. Server error ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error sending images:', error);
            toast.error('Failed to send images. Please try again.');
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
                                    You can choose only <span className="yellow">Banana</span>, <span className="orange">Orange</span>, or <span className="red">Apple</span> for testing.
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
                                            multiple
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

                                {/* Display uploaded images */}
                                <div id="uploadedImages" className="mt-3">
                                    {uploadedImageSrcs.map((src, index) => (
                                        <img key={index} src={src} alt={`Uploaded ${index + 1}`} width="100%" />
                                    ))}
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
