// index.js
document.addEventListener('DOMContentLoaded', function() {
    // API Configuration - Change this URL when deploying to different environments
    const API_URL = 'https://myfoodisgettingcold.hopto.org/digits_recognition';
    
    // Canvas elements
    const canvases = [
        document.getElementById('canvas1'),
        document.getElementById('canvas2'),
        document.getElementById('canvas3')
    ];
    
    // Canvas contexts
    const contexts = canvases.map(canvas => canvas.getContext('2d', { willReadFrequently: true }));
    
    // Shared drawing state
    let lineWidth = 2;  // Increased slightly for better visibility
    let strokeColor = '#000000';
    const activeCanvas = { index: null, isPainting: false };
    
    // Initialize each canvas with white background
    contexts.forEach(ctx => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 28, 28);
    });
    
    // Clear button handler
    document.getElementById('clear').addEventListener('click', () => {
        contexts.forEach(ctx => {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 28, 28);
        });
        
        // Clear prediction results
        document.getElementById('result').textContent = 'Draw and click Calculate';
        document.getElementById('num1-pred').textContent = '';
        document.getElementById('op-pred').textContent = '';
        document.getElementById('num2-pred').textContent = '';
        document.getElementById('num1-conf').textContent = '';
        document.getElementById('op-conf').textContent = '';
        document.getElementById('num2-conf').textContent = '';
    });
    
    // Calculate button handler
    document.getElementById('calculate').addEventListener('click', () => {
        // Get pixel values from all three canvases
        const digitValues1 = getPixelValues(0);
        const operatorValues = getPixelValues(1);
        const digitValues2 = getPixelValues(2);
        
        // Send to Flask backend
        sendPredictionRequest(digitValues1, operatorValues, digitValues2);
    });
    
    // Setup each canvas
    canvases.forEach((canvas, index) => {
        const ctx = contexts[index];
        
        // Mouse events for drawing
        canvas.addEventListener('mousedown', (e) => {
            activeCanvas.index = index;
            activeCanvas.isPainting = true;
            
            // Get scaled mouse position
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            // Start new path
            ctx.beginPath();
            ctx.moveTo(x, y);
            
            // Draw a dot for single clicks
            ctx.fillStyle = strokeColor;
            ctx.beginPath();
            ctx.arc(x, y, lineWidth/2, 0, Math.PI * 2);
            ctx.fill();
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!activeCanvas.isPainting || activeCanvas.index !== index) return;
            
            // Get scaled mouse position
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            // Draw line
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = strokeColor;
            
            ctx.lineTo(x, y);
            ctx.stroke();
        });
        
        // Touch events for mobile
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            activeCanvas.index = index;
            activeCanvas.isPainting = true;
            
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            
            ctx.fillStyle = strokeColor;
            ctx.beginPath();
            ctx.arc(x, y, lineWidth/2, 0, Math.PI * 2);
            ctx.fill();
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!activeCanvas.isPainting || activeCanvas.index !== index) return;
            
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;
            
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = strokeColor;
            
            ctx.lineTo(x, y);
            ctx.stroke();
        });
    });
    
    // Global mouse and touch end events
    document.addEventListener('mouseup', () => {
        activeCanvas.isPainting = false;
    });
    
    document.addEventListener('mouseleave', () => {
        activeCanvas.isPainting = false;
    });
    
    document.addEventListener('touchend', () => {
        activeCanvas.isPainting = false;
    });
    
    document.addEventListener('touchcancel', () => {
        activeCanvas.isPainting = false;
    });
    
    // Function to get pixel values
    function getPixelValues(canvasIndex) {
        const ctx = contexts[canvasIndex];
        const canvas = canvases[canvasIndex];
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Create a 28x28 array of grayscale values (0-255)
        const pixelValues = [];
        
        for (let y = 0; y < canvas.height; y++) {
            const row = [];
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                // For grayscale, just take the red channel (could also average R,G,B)
                // Invert the value for ML use (white background = 0, black drawing = 255)
                const pixelValue = 255 - data[pixelIndex];
                row.push(pixelValue);
            }
            pixelValues.push(row);
        }
        
        return pixelValues;
    }
    
    // Function to send prediction request to Flask backend
    function sendPredictionRequest(digit1Values, operatorValues, digit2Values) {
        // Check if all three canvases have drawings
        if (!hasDrawing(digit1Values) || !hasDrawing(operatorValues) || !hasDrawing(digit2Values)) {
            document.getElementById('result').textContent = "Please draw in all three canvases";
            return;
        }
        
        // Show loading state
        document.getElementById('result').textContent = "Processing...";
        
        // Prepare data for backend
        const requestData = {
            digit1: digit1Values,
            operator: operatorValues,
            digit2: digit2Values
        };
        
        // Send to Flask backend
        fetch(`${API_URL}/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            return response.json().then(data => {
                if (!response.ok) {
                    // Even if the response has an error status code,
                    // try to display whatever info we got back
                    if (data.digit1 && data.operator && data.digit2) {
                        updatePredictionDisplay(data);
                    }
                    throw new Error(data.error || 'Network response was not ok');
                }
                return data;
            });
        })
        .then(data => {
            // Update UI with successful results
            updatePredictionDisplay(data);
        })
        .catch((error) => {
            console.error('Error:', error);
            document.getElementById('result').textContent = "Error: " + error.message + 
                "\nPlease try drawing more clearly.";
        });
    }
    
    // Helper function to update the prediction display
    function updatePredictionDisplay(data) {
        // Update UI with results
        const result = document.getElementById('result');
        const num1Pred = document.getElementById('num1-pred');
        const opPred = document.getElementById('op-pred');
        const num2Pred = document.getElementById('num2-pred');
        const num1Conf = document.getElementById('num1-conf');
        const opConf = document.getElementById('op-conf');
        const num2Conf = document.getElementById('num2-conf');
        
        // Display prediction results
        if (data.calculated_result) {
            result.textContent = data.calculated_result;
        } else {
            result.textContent = "Could not calculate result";
        }
        
        // Display predictions and confidence even if there was an error
        num1Pred.textContent = data.digit1 || '?';
        opPred.textContent = data.operator || '?';
        num2Pred.textContent = data.digit2 || '?';
        
        // Display confidence if available
        if (data.digit1_confidence) {
            num1Conf.textContent = `(${Math.round(data.digit1_confidence * 100)}%)`;
        }
        if (data.operator_confidence) {
            opConf.textContent = `(${Math.round(data.operator_confidence * 100)}%)`;
        }
        if (data.digit2_confidence) {
            num2Conf.textContent = `(${Math.round(data.digit2_confidence * 100)}%)`;
        }
    }
    
    // Helper function to check if there's drawing in the canvas
    function hasDrawing(pixelValues) {
        for (let y = 0; y < pixelValues.length; y++) {
            for (let x = 0; x < pixelValues[y].length; x++) {
                if (pixelValues[y][x] > 20) { // threshold
                    return true;
                }
            }
        }
        return false;
    }
});
