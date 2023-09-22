const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

const app = express();
const port = 3000;

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

const UNICHECK_CLIENT_ID = '925b2aff0f53a0a2048f';
const UNICHECK_CLIENT_SECRET = 'd6c89b67f2c80abcb8639e9cc6dbb6d576574735';
const UNICHECK_API_URL = 'https://api.unicheck.com';

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;

    const tokenResponse = await axios.post(
      `${UNICHECK_API_URL}/oauth/access-token`,
      `grant_type=client_credentials&client_id=${UNICHECK_CLIENT_ID}&client_secret=${UNICHECK_CLIENT_SECRET}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      console.error('Access token not found in the response.');
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const uploadResponse = await axios.post(
      `${UNICHECK_API_URL}/files`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/vnd.api+json',
          ...formData.getHeaders(),
        },
      }
    );

    // Check if the upload was successful
    if (uploadResponse.status === 202) {
      // Initiate the similarity check immediately
      const fileID = uploadResponse.data.data.id;
      const similarityCheckResponse = await initiateSimilarityCheck(fileID, accessToken);
      
      // Send the response from Unicheck to the client
      res.status(similarityCheckResponse.status).json(similarityCheckResponse.data);
    } else {
      console.error('File upload failed:', uploadResponse.status, uploadResponse.statusText);
      res.status(uploadResponse.status).json({ error: 'File upload failed' });
    }
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

async function initiateSimilarityCheck(fileID, accessToken) {
  try {
    const similarityCheckResponse = await axios.post(
      `${UNICHECK_API_URL}/similarity/checks`,
      {
        data: {
          type: 'similarityCheck',
          attributes: {
            search_types: { web: true, library: false },
            parameters: {
              sensitivity: { percentage: 0, words_count: 8 },
            },
          },
          relationships: {
            file: {
              data: {
                id: fileID,
                type: 'file',
              },
            },
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/vnd.api+json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return similarityCheckResponse;
  } catch (error) {
    console.error('Similarity Check Error:', error);
    throw error;
  }
}

app.get('/', (req, res) => {
  res.render('index');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
