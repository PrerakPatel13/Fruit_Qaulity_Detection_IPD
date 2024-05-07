import React, { useState, useRef } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  const [cameraOn, setCameraOn] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
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
      // Capture the current frame from the video feed onto the canvas
      const context = canvasRef.current.getContext('2d');
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // Convert the canvas content to a base64 data URL (image)
      const imageSrc = canvasRef.current.toDataURL('image/png');
      setUploadedImageSrc(imageSrc);

      // Convert the data URL image to a Blob for form data
      const formData = new FormData();
      formData.append('image', dataURIToBlob(imageSrc));

      // Send a POST request to the prediction endpoint
      await predictImage(formData);
    }
  };

  const handleFileSelection = (event) => {
    const fileUploadControl = event.target;
    if (fileUploadControl.files.length > 0) {
      const file = fileUploadControl.files[0];
      setSelectedFile(file); // Store the selected file
      setUploadedImageSrc(URL.createObjectURL(file)); // Display the selected image
    }
  };

  const handleLoadImage = async () => {
    if (!selectedFile) {
      toast.error('Please select an image file first.');
      return;
    }

    // Create a form data object and append the selected file
    const formData = new FormData();
    formData.append('image', selectedFile);

    // Send a POST request to the prediction endpoint
    await predictImage(formData);
  };

  // Function to handle prediction with given form data
  const predictImage = async (formData) => {
    try {
      const response = await fetch('https://65e5-2405-201-34-80ac-9c94-d5f-4fd9-53f4.ngrok-free.app/predict', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Prediction result:', data);

        // Find the class with the highest probability
        const { className, percentage } = getClassWithHighestProbability(data.output, classNames);

        // Extract the grade from the response
        const grade = data.Grade || 'N/A'; // Fallback to 'N/A' if grade is not present

        // Display the prediction result
        if (labelContainerRef.current) {
          labelContainerRef.current.innerHTML = `
            <p>Prediction: ${className}</p>
            <p>Percentage: ${percentage}%</p>
            <p>Grade: ${grade}</p>
          `;
        }

        // Show success toast
        toast.success(`Image successfully uploaded and prediction received.`);
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

  // Utility function to find the class with the highest probability
  function getClassWithHighestProbability(output, classNames) {
    let maxProbability = Math.max(...output);
    let index = output.indexOf(maxProbability);
    let className = classNames[index];
    let percentage = (maxProbability ).toFixed(2); // Convert to percentage and round to 2 decimal places

    return {
      className,
      percentage
    };
  }

  // Utility function to convert a base64 data URI to a Blob
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
                <h3 className="card-title py-3 title" id="detect">Determine whether your fruit is fresh or rotten</h3>
                <p className="px-3">
                  You can choose only <span className="yellow">Banana</span>, <span className="orange">Orange</span>, or <span className="red">Apple</span> for testing.
                </p>
                <p className="px-3">
                  For doing so, you can either use your webcam and show the fruit or upload an image from your device.
                </p>
                <div className="px-3">
                  <label htmlFor="webcam" className="pt-3 pb-2 d-block">USE WEBCAM:</label>
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

                {/* Show uploaded image */}
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
