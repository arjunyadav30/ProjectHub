const apiResponse = {
  success: (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({ success: true, message, data });
  },
  error: (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
    const response = { success: false, message };
    if (errors) response.errors = errors;
    return res.status(statusCode).json(response);
  },
  created: (res, data, message = 'Created successfully') => {
    return res.status(201).json({ success: true, message, data });
  },
  noContent: (res) => {
    return res.status(204).send();
  },
};

module.exports = apiResponse;
