const { parseTracklistFromEpisodeHtml, getNtsEpisodePlaylist } = require("../src/lib/nts");

describe("NTS tracklist parsing", () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test("parses only real tracklist rows from episode markup", () => {
    const html = `
      <html>
        <head><title>Episode Title | Listen on NTS</title></head>
        <body>
          <div class="tracklist">
            <h4 class="tracklist__heading">Tracklist</h4>
            <ul class="tracklist__tracks">
              <li class="track">
                <div class="track__detail">
                  <span class="track__timestamp track__timestamp--teaser">0:03:40</span>
                  <div>
                    <div class="track__artists">
                      <span class="track__artist">Mamadou Doumbia</span>
                      <span class="track__artist track__artist--mobile" style="display:none">Mamadou Doumbia</span>
                    </div>
                    <div class="track__title">Komi Ikalon</div>
                  </div>
                </div>
              </li>
              <li class="track">
                <div class="track__detail">
                  <span title="Timestamp unavailable" class="track__timestamp track__timestamp--teaser">--:--</span>
                  <div>
                    <div class="track__artists"><span class="track__artist">Jack Arel</span></div>
                    <div class="track__title">Something Happen</div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </body>
      </html>
    `;

    expect(parseTracklistFromEpisodeHtml(html)).toEqual([
      {
        startSeconds: 220,
        title: "Komi Ikalon",
        artist: "Mamadou Doumbia",
        image: ""
      },
      {
        startSeconds: undefined,
        title: "Something Happen",
        artist: "Jack Arel",
        image: ""
      }
    ]);
  });

  test("ignores generic error pages and returns no tracks", async () => {
    const html = `
      <html>
        <head>
          <title>Page Not Found</title>
          <meta property="og:description" content="404 Page Not Found">
        </head>
        <body>
          <div>0:00:00</div>
          <div>Up Next Similar to what you are listening to</div>
          <script>window.__REACT_STATE__ = {"radioPlayer":{"clientName":"NTSWebApp"}}</script>
        </body>
      </html>
    `;

    expect(parseTracklistFromEpisodeHtml(html)).toEqual([]);

    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => html,
      json: async () => ({ results: [] })
    }));

    const playlist = await getNtsEpisodePlaylist("https://www.nts.live/shows/example/episodes/example-episode");
    expect(playlist.tracks).toEqual([]);
  });
});
