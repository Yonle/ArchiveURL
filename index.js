const http = require("http"); // Used to create server
const got = require("got"); // Used to request
const fs = require("fs"); // Used to read / create archives
const toHtml = require("object.tohtml"); // Used to creating main page

let server = http.createServer();
// Main page
let mainPage = {
  html: {
    head: [
      { title: "ArchiveURL" },
      {
        meta: {
          attrOnly: true,
          name: "viewport",
          content: "width:device-width, initial-scale=1",
        },
      },
      {
        meta: {
          attrOnly: true,
          name: "description",
          content: "A simple Website Archiver",
        },
      },
    ],
    body: {
      h1: "ArchiveURL",
      p: "A simple Website Archiver",
      form: {
        attr: {
          action: "/__go",
        },
        input: {
          attr: {
            name: "u",
            type: "url",
            placeholder: "Enter URL here then press Enter.",
            style: "width: 60%;",
          },
        },
      },
      h4: "Note: Do NOT share Archive URL by cupy pasting from Address bar!!!<br><br>That URL in address bar is NOT GONNA WORK!!!!!!",
    },
  },
};

server.on("request", (req, res) => {
  if (req.url === "/") return mainPage.toHtml(res);
  let host = req.headers.host;
  // Hide some sensitive header

  ["x-forwarded-from", "host", "referer"].forEach((header) => {
    if (!req.headers[header]) return;
    delete req.headers[header];
  });

  switch (req.url.split("?")[0].slice(1).split("/")[0]) {
    case "__go":
      let parsed = new URL("http://" + host + req.url);
      if (!parsed.searchParams.has("u")) {
        res.writeHead(400).end("No URL");
      } else {
        try {
          let url = new URL(parsed.searchParams.get("u"));
          res.writeHead(301, { location: "/archive/" + url.href }).end();
        } catch (e) {
          res.writeHead(400).end("No URL");
        }
      }
      break;
    case "archive":
      try {
        let url = new URL(req.url.slice(9));
        if (!url) return res.writeHead(301, { location: "/" }).end();

        url.filename = url.href.replace(RegExp("/", "g"), "\\");

        // Check whenever there's archive directory.
        // Else, Create one.
        ["/archive", "/archive/data", "/archive/headers"].forEach((path) => {
          try {
            fs.openSync(__dirname + path);
          } catch (err) {
            fs.mkdirSync(__dirname + path);
          }
        });

        let archive = fs.createReadStream(
          __dirname + "/archive/data/" + url.filename,
          {
            start: req.headers.Range || 0,
            highWaterMark: 192 * 1024,
          }
        );
        
        archive.on("ready", () =>
          archive.pipe(
            res.writeHead(
              200,
              JSON.parse(
                fs.readFileSync(
                  __dirname + "/archive/headers/" + url.filename,
                  "utf8"
                )
              )
            )
          )
        );

        archive.on("error", () => {
          let stream = got.stream(url.href, {
            headers: req.headers,
          });

          stream.on("error", (e) => res.end(e.toString()));
          stream.on("response", (response) => {
            delete response.headers["content-encoding"];
            let contenttype = response.headers["content-type"];

            fs.writeFileSync(
              __dirname + "/archive/headers/" + url.filename,
              JSON.stringify(response.headers),
              "utf8"
            );

            stream.pipe(
              fs.createWriteStream(__dirname + "/archive/data/" + url.filename)
            );

            stream.on("end", () => {
              // We're gonna inject the text file such as the css, js, html, and more so like that
              if (contenttype && contenttype.startsWith("text/")) {
                let file = fs.readFileSync(
                  __dirname + "/archive/data/" + url.filename,
                  "utf8"
                );

                [
                  ["\"/", `"/archive/${url.protocol}://${url.hostname}/`],
                  ["'/", `'/archive/${url.protocol}://${url.hostname}/`],
                  ["http://", "/archive/http://"],
                  ["https://", "/archive/https://"],
                  [
                    `/archive/${url.protocol}://${url.hostname}//`,
                    `/archive/${url.protocol}://`,
                  ],
                  [":://", "://"],
                  ["/../", "/"]
                ].forEach((i) => {
                  file = file.replace(
                    RegExp(i[0], "g"),
                    i[1] || `${host}/archive/${url.protocol}://${url.hostname}/`
                  );
                });

                fs.writeFileSync(
                  __dirname + "/archive/data/" + url.filename,
                  file,
                  "utf8"
                );

                res.writeHead(200, response.headers).end(file);
              } else {
                let archive = fs.createReadStream(
                  __dirname + "/archive/data/" + url.filename,
                  {
                    start: req.headers.Range || 0,
                    highWaterMark: 192 * 1024,
                  }
                );

                archive.on("ready", () => archive.pipe(res));
                archive.on("error", (e) => res.end(e.toString()));
              }
            });
          });
        });
      } catch (e) {
        res.writeHead(301, { location: "/" });
        res.end(e.toString());
      }
      break;
    default:
      res.writeHead(301, { location: "/" });
      res.end();
      break;
  }
});

let listener = server.listen(process.env.PORT || 3000, () => {
  console.log("Now listening on port", listener.address().port);
});
