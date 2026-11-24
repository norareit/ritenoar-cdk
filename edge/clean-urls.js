// `canonicalHost` (a host name or null) and `securityHeaders` (an object of { value } per header name, empty when none
// are sent) are declared ahead of this source by src/clean-urls-function.ts, so the source tested is the source
// deployed. The redirects below are answered here and never reach the origin, so the response headers policy of the
// distribution does not apply to them, and they carry the security headers themselves.

function redirect(location) {
  var headers = { location: { value: location } };
  for (var name in securityHeaders) {
    headers[name] = securityHeaders[name];
  }
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: headers,
  };
}

// Whether text ends in suffix. Comparing indexOf with a length goes wrong for a path shorter than the suffix, where
// both are -1, and for a suffix that also occurs earlier in the path.
function endsWith(text, suffix) {
  return text.length >= suffix.length && text.substring(text.length - suffix.length) === suffix;
}

// The query string of a request as a redirect repeats it. The runtime gives each value as it was received, so none is
// encoded again, and it cannot tell ?flag from ?flag=, so a parameter without a value is written bare. A name given
// more than once has its values in multiValue, and its value is the first of them.
function queryString(querystring) {
  var parts = [];
  for (var name in querystring) {
    var field = querystring[name];
    var values = field.multiValue ? field.multiValue : [field];
    for (var index = 0; index < values.length; index++) {
      var value = values[index].value;
      parts.push(value === '' ? name : name + '=' + value);
    }
  }
  return parts.length === 0 ? '' : '?' + parts.join('&');
}

function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (canonicalHost !== null && request.headers.host && request.headers.host.value === 'www.' + canonicalHost) {
    return redirect('https://' + canonicalHost + uri + queryString(request.querystring));
  }

  // The extensionless URL is canonical, so .html always redirects to it.
  if (endsWith(uri, '.html')) {
    var stripped = uri.substring(0, uri.length - 5);
    if (endsWith(stripped, '/index')) {
      stripped = stripped.substring(0, stripped.length - 6);
    }
    return redirect((stripped.length === 0 ? '/' : stripped) + queryString(request.querystring));
  }

  if (uri === '/') {
    return request;
  }

  // Serve the clean URL from its .html file, leaving real assets (anything with a
  // dot in the last path segment: .css, .js, .png, .xml, .txt, ...) alone.
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  if (lastSegment.length > 0 && lastSegment.indexOf('.') === -1) {
    request.uri = uri + '.html';
  }

  return request;
}
