'use strict';

exports.handler = (event, context, callback) => {
    const request = event.Records[0].cf.request;
    const headers = request.headers;

    // Only process image requests (extension based)
    const uri = request.uri;
    const extension = uri.split('.').pop().toLowerCase();
    
    if (!['jpg', 'jpeg', 'png'].includes(extension)) {
        callback(null, request);
        return;
    }

    // Capture Accept header
    const accept = headers['accept'] ? headers['accept'][0].value : '';
    const baseUri = uri.substring(0, uri.lastIndexOf('.'));

    console.log(`URI: ${uri}, Accept: ${accept}`);

    // Selection Logic (AVIF > WebP > Original)
    if (accept.includes('image/avif')) {
        request.uri = `${baseUri}.avif`;
    } else if (accept.includes('image/webp')) {
        request.uri = `${baseUri}.webp`;
    }

    // Note: This assumes the optimized files exist.
    // In a prod environment, our S3 Trigger Lambda ensures these exist within seconds.

    callback(null, request);
};
