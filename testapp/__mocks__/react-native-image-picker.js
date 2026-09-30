module.exports = {
  launchCamera: jest.fn(() =>
    Promise.resolve({
      didCancel: false,
      assets: [{ uri: 'file:///mock/captured_sample.jpg' }],
    })
  ),
  launchImageLibrary: jest.fn(() =>
    Promise.resolve({
      didCancel: false,
      assets: [{ uri: 'file:///mock/uploaded_sample.jpg' }],
    })
  ),
};
