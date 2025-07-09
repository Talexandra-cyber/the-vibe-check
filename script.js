const apiKey = 'AIzaSyDaSfgPlMI9tETf7roHiHtEchpmxonM8N4';

document.addEventListener('DOMContentLoaded', () => {
  console.log('The Vibe Check page loaded');
  
  const imageUploader = document.getElementById('image-uploader');
  const imagePreview = document.getElementById('image-preview');
  const jsonOutput = document.getElementById('json-output');
  imageUploader.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    
    if (file && file.type.startsWith('image/')) {
      // Display the image preview
      const reader = new FileReader();
      reader.onload = async (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        
        // Analyze the image after it's displayed
        await analyzeImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  });
});

async function analyzeImage(base64Image) {
  const jsonOutput = document.getElementById('json-output');
  
  // Show loading message
  jsonOutput.textContent = 'Loading...';
  
  try {
    // Extract base64 data and MIME type from the data URL
    const [mimeTypePart, base64Data] = base64Image.split(',');
    const mimeType = mimeTypePart.match(/data:([^;]+)/)[1];
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: 'Analyze the following image and return a JSON object with three keys: "product_name" (e.g., "sneaker"), "main_colors" (an array of strings), and "style" (e.g., "vintage").'
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Extract the text response from Gemini
    const aiResponse = data.candidates[0].content.parts[0].text;
    
    // Try to parse JSON from the AI response
    try {
      // Look for JSON in the response (it might be wrapped in markdown code blocks)
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      
      const parsedJson = JSON.parse(jsonString);
      
      // Display the data in a user-friendly format
      jsonOutput.textContent = `Product: ${parsedJson.product_name}
Colors: ${parsedJson.main_colors.join(', ')}
Style: ${parsedJson.style}`;
      
      // Automatically generate the hype blurb after successful analysis
      await generateHypeBlurb(parsedJson);
      
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      jsonOutput.textContent = `Error parsing JSON: ${aiResponse}`;
    }
    
  } catch (error) {
    console.error('Error analyzing image:', error);
    jsonOutput.textContent = `Error: ${error.message}`;
  }
}

async function generateHypeBlurb(productInfo) {
  const blurbOutput = document.getElementById('blurb-output');
  
  // Show loading message
  blurbOutput.textContent = 'Loading...';
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a marketing copywriter for a Gen Z brand. Using the following product attributes, write a short, exciting hype blurb (1-2 sentences): ${JSON.stringify(productInfo)}`
          }]
        }]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Extract the text response from Gemini
    const hypeBlurb = data.candidates[0].content.parts[0].text;
    
    // Display the hype blurb
    blurbOutput.textContent = hypeBlurb.trim();
    
    // Add event listener to play audio button
    const playAudioBtn = document.getElementById('play-audio-btn');
    playAudioBtn.onclick = () => playHypeAudio(hypeBlurb.trim());
    
  } catch (error) {
    console.error('Error generating hype blurb:', error);
    blurbOutput.textContent = `Error: ${error.message}`;
  }
}

function sanitizeTextForSpeech(text) {
  // Step 1: Replace em-dashes and en-dashes with commas for natural pauses
  let cleanedText = text.replace(/[—–]/g, ',');
  
  // Step 2: Remove emojis and other non-alphanumeric characters except standard punctuation
  cleanedText = cleanedText.replace(/[^\w\s.,!?;:'"()-]/g, '');
  
  return cleanedText.trim();
}

function getBestVoice() {
  return new Promise((resolve) => {
    const findBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      
      if (voices.length === 0) {
        // Voices not loaded yet, wait for the event
        return null;
      }
      
      let selectedVoice = null;
      
      // Priority 1: Look for Google voices (highest quality)
      selectedVoice = voices.find(voice => 
        voice.name.includes('Google') && voice.lang.includes('en')
      );
      
      // Priority 2: Look for Microsoft voices
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          voice.name.includes('Microsoft') && voice.lang.includes('en')
        );
      }
      
      // Priority 3: Look for non-local service voices (cloud-based, higher quality)
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          !voice.localService && voice.lang.includes('en')
        );
      }
      
      // Priority 4: Look for any English voice with good names
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          (voice.name.includes('Samantha') || 
           voice.name.includes('Alex') || 
           voice.name.includes('Karen') ||
           voice.name.includes('Zira')) && 
          voice.lang.includes('en')
        );
      }
      
      // Priority 5: Fallback to any English voice
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.lang.includes('en'));
      }
      
      return selectedVoice;
    };
    
    // Try to find voice immediately
    const voice = findBestVoice();
    if (voice) {
      resolve(voice);
      return;
    }
    
    // If no voices found, wait for voices to load
    const handleVoicesChanged = () => {
      const voice = findBestVoice();
      if (voice) {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve(voice);
      }
    };
    
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    
    // Fallback timeout in case voices never load
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(null);
    }, 3000);
  });
}

async function playHypeAudio(text) {
  // Check if speech synthesis is supported
  if (!('speechSynthesis' in window)) {
    alert('Sorry, your browser does not support text-to-speech!');
    return;
  }
  
  try {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Sanitize the text for speech
    const sanitizedText = sanitizeTextForSpeech(text);
    
    if (!sanitizedText) {
      alert('No valid text to speak!');
      return;
    }
    
    // Get the best available voice
    const bestVoice = await getBestVoice();
    
    // Create a new speech synthesis utterance
    const utterance = new SpeechSynthesisUtterance(sanitizedText);
    
    // Configure the voice settings for better quality
    utterance.rate = 1.1; // Slightly faster for energy
    utterance.pitch = 1.1; // Slightly higher pitch for excitement
    utterance.volume = 1.0; // Full volume
    
    // Set the selected high-quality voice
    if (bestVoice) {
      utterance.voice = bestVoice;
      console.log('Using voice:', bestVoice.name);
    } else {
      console.log('Using default voice');
    }
    
    // Speak the text
    window.speechSynthesis.speak(utterance);
    
  } catch (error) {
    console.error('Error playing audio:', error);
    alert('Error playing audio. Please try again.');
  }
} 