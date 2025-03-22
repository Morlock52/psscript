/**
 * Patch for index.js to add Voice API routes
 * 
 * This file contains the code that should be added to index.js to integrate the Voice API routes.
 */

// Add this import with the other route imports
const voiceRoutes = require('./routes/voiceRoutes');

// Add this line with the other app.use statements for routes
app.use('/api/voice', voiceRoutes);

/**
 * Example of how to integrate the Voice API routes into index.js:
 * 
 * 1. Add the import at the top of the file with the other route imports:
 *    ```javascript
 *    const voiceRoutes = require('./routes/voiceRoutes');
 *    ```
 * 
 * 2. Add the route registration with the other app.use statements for routes:
 *    ```javascript
 *    app.use('/api/voice', voiceRoutes);
 *    ```
 * 
 * 3. Make sure the voiceRoutes.js file is in the routes directory.
 * 
 * 4. Make sure the voiceController.js file is in the controllers directory.
 */