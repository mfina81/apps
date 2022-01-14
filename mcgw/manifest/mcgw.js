apiVersion: v1
kind: ConfigMap
metadata:
  name: mcgw-js
  namespace: nginx-mcgw
data:
  mcgw.js: |-
    export default {dbQuery};

    function dbQuery(r) {
      var dbBucket="mcgw";

      r.warn('------------------------------');
      r.warn('Client['+r.remoteAddress+'] Method['+r.method+'] Host['+r.headersIn['host']+'] URI ['+r.uri+'] Body['+r.requestBody+']');

      // Queries the backend db
      r.subrequest('/dbQuery/api/datagrid/default/buckets/'+dbBucket+'/keys/'+r.headersIn['host']+r.uri,'',subReqCallback);

      function subReqCallback(reply) {
        if(reply.status!=200) {
          // Rule not found

          r.warn('Rule not found - returning 404');
          r.return(404);
        } else {
          r.warn('subReqCallback got 200');
          r.warn('JSON reply: URI['+reply.uri+'] status['+reply.status.toString()+'] body['+reply.responseText+']');

          var body = JSON.parse(reply.responseText);

          if (body.rule.enabled=='false') {
            // Rule is disabled

            r.warn('Rule is disabled - returning 404');
            r.return(404);
          } else {
            r.warn('Rewrite rule ['+r.headersIn['host']+r.uri+'] -> ['+body.rule.rewrite+'] X-REDIRECT-SUPPORT ['+r.headersIn['X-REDIRECT-SUPPORT']+']');

            if(r.headersIn['X-REDIRECT-SUPPORT']=='true') {
              // Client supports HTTP 302 - Redirect mode

              r.warn('Redirect mode 302 to ['+body.rule.rewrite+']');
              r.return(302,body.rule.rewrite);
            } else {
              // Client does not support HTTP 302 - Steering mode

              r.warn('Steering mode to ['+body.rule.rewrite+']');

              // Proxies the client request
              r.subrequest('/steeringMode/'+body.rule.rewrite,{method: r.method},steeringModeSubReqCallback);
            }
          }
        }

        function steeringModeSubReqCallback(steeringReply) {
          // Steering mode - returns the steered API response back to the client

          r.warn('steeringModeSubReqCallback got ['+steeringReply.status+'] ['+steeringReply.responseText+']');

          r.status=steeringReply.status;

          for (var header in steeringReply.headersOut) {
            r.headersOut[header] = steeringReply.headersOut[header];
          }

          r.sendHeader();
          r.send(steeringReply.responseText);
          r.finish();
        }
      }
    }

