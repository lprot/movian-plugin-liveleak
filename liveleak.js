/**
 * LiveLeak.com plugin for Movian Media Center
 *
 *  Copyright (C) 2015-2018 lprot
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var page = require('showtime/page');
var service = require('showtime/service');
var settings = require('showtime/settings');
var http = require('showtime/http');

var plugin = JSON.parse(Plugin.manifest);
var logo = Plugin.path + plugin.icon;

var BASE_URL = 'http://www.liveleak.com';

var blue = '6699CC', orange = 'FFA500', red = 'EE0000', green = '008B45';

function coloredStr(str, color) {
    return '<font color="' + color + '">' + str + '</font>';
}

function setPageHeader(page, title) {
    if (page.metadata) {
        page.metadata.title = title;
        page.metadata.logo = logo;
    }
    page.type = "directory";
    page.contents = "items";
    page.entries = 0;
    page.loading = true;
}

function trim(s) {
    return s.replace(/(\r\n|\n|\r)/gm, "").replace(/(^\s*)|(\s*$)/gi, "").replace(/[ ]{2,}/gi, " ").replace(/\t/g, ' ');
}

service.create(plugin.title, plugin.id + ":start", 'video', true, logo);
  
new page.Route(plugin.id + ":play:(.*):(.*)", function(page, url, title) {
    page.loading = true;
    var doc = http.request(unescape(url)).toString();
    var title = showtime.entityDecode(unescape(title));
    var match = doc.match(/config: "([\S\s]*?)"/g);
    if (!match) { // internal
         match = doc.match(/<iframe[\S\s]*?src="([\S\s]*?)"/);
         if (match[1].match(/youtube/)) {
             page.redirect('youtube:video:' + doc.match(/embed\/([\S\s]*?)\?rel/)[1]);
         }
         doc = http.request(match[1]).toString();
         lnk = doc.match(/<source src="([\S\s]*?)"/)[1];
         page.type = "video";
         page.source = "videoparams:" + showtime.JSONEncode({
             title: title,
             no_fs_scan: true,
             canonicalUrl: plugin.id + ':play:' + url + ':' + title,
             sources: [{
                 url: lnk
             }],
             no_subtitle_scan: true
        });
    } else if (match.length == 1) {
        page.type = "video";
        var lnk = match[0].match(/hd_file_url=([\S\s]*?)&/);
        if (lnk)
            lnk = lnk[1]
        else
            lnk = match[0].match(/file_url=([\S\s]*?)&/)[1];
        page.source = "videoparams:" + showtime.JSONEncode({
            title: title,
            no_fs_scan: true,
            canonicalUrl: plugin.id + ':play:' + url + ':' + title,
            sources: [{
                url: unescape(lnk)
            }],
            no_subtitle_scan: true
        });
    } else {
        setPageHeader(page, doc.match(/<title>([\S\s]*?)<\/title>/)[1]);
        for (var i=0; i < match.length; i++) {
            var lnk = match[i].match(/hd_file_url=([\S\s]*?)&/);
            if (lnk)
                lnk = lnk[1]
            else
                lnk = match[i].match(/file_url=([\S\s]*?)&/)[1];

            var link = "videoparams:" + showtime.JSONEncode({
                title: title + '_part' + (i + 1),
                no_fs_scan: true,
                canonicalUrl: plugin.id + ':' + url + ':' + title + '_part' + (i + 1),
                sources: [{
                    url: unescape(lnk)
                }],
                no_subtitle_scan: true
            });
            page.appendItem(link, "video", {
                title: title + '_part' + (i + 1),
                icon: unescape(match[i].match(/preview_image_url=([\S\s]*?)&/)[1])
            });
        }
    }
    page.loading = false;
});

function scrape_videos(page, url) {
    var fromPage = 1, tryToSearch = true;
    // 1-link, 2-icon, 3-title, 4-genres, 5-marks, 6-description, 7-info
    var re = /<div class="thumbnail_column"[\S\s]*?<a href="([\S\s]*?)"[\S\s]*?src="([\S\s]*?)"[\S\s]*?title="([\S\s]*?)"[\S\s]*?title="Rating: ([\S\s]*?)"[\S\s]*?<div class="item_info_column">([\S\s]*?)<br \/>([\S\s]*?)<h4>([\S\s]*?)<\/div>/g;

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var doc = http.request(BASE_URL + url + '&page=' + fromPage).toString();
        page.loading = false;

        var match = re.exec(doc);
        while (match) {
            page.appendItem(plugin.id + ":play:" + escape(match[1]) + ':' + escape(match[3]), "video", {
                title: new showtime.RichText(match[5].match(/hd_video_icon/) ? coloredStr('HD ', orange) + showtime.entityDecode(match[3]) : showtime.entityDecode(match[3])),
                icon: match[2],
                genre: match[4],
                description: new showtime.RichText(coloredStr('Description: ', orange) + trim(match[6]) + '\n' + trim(match[7]))
            });
            match = re.exec(doc);
            page.entries++;
        }
        fromPage++;
        return true;
    }
    loader();
    page.paginator = loader;
};

new page.Route(plugin.id + ":scrapeChannel:(.*):(.*)", function(page, url, title) {
    setPageHeader(page, plugin.title + ' - ' + unescape(title));
    var fromPage = 1, tryToSearch = true;
    // 1-link, 2-icon, 3-title, 4-genres, 5-marks, 6-description, 7-info
    var re = /<div class="thumbnail_column"[\S\s]*?<a href="([\S\s]*?)"[\S\s]*?src="([\S\s]*?)"[\S\s]*?title="([\S\s]*?)"[\S\s]*?title="Rating: ([\S\s]*?)"[\S\s]*?<div class="item_info_column">([\S\s]*?)<br \/>([\S\s]*?)<h4>([\S\s]*?)<\/div>/g;
    var url = unescape(url);

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var doc = http.request(url).toString();
        page.loading = false;

        var match = re.exec(doc);
        if (!match) return tryToSearch = false;
        while (match) {
            page.appendItem(plugin.id + ":play:" + escape(match[1]) + ':' + escape(match[3]), "video", {
                title: new showtime.RichText(match[5].match(/hd_video_icon/) ? coloredStr('HD ', orange) + match[3] : match[3]),
                icon: match[2],
                genre: match[4],
                description: new showtime.RichText(coloredStr('Description: ', orange) + trim(match[6]) + '\n' + trim(match[7]))
            });
            match = re.exec(doc);
            page.entries++;
        }
        fromPage++;
        url = BASE_URL + '/' + doc.match(/argument_url = '([\S\s]*?)'/)[1] + '&page=' + fromPage;
        return true;
    }
    loader();
    page.paginator = loader;
});

function scrape_channels(page, url) {
    var fromPage = 1, tryToSearch = true;
    page.entries = 0;
    // 1-link, 2-title, 3-icon, 4-description, 5-info
    var re = /<span><a href="([\S\s]*?)" title="([\S\s]*?)"><img src="([\S\s]*?)"[\S\s]*?<\/h2>([\S\s]*?)<\/span><h3>([\S\s]*?)<br \/>/g;

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var doc = http.request(BASE_URL + url + '&page=' + fromPage).toString();
        page.loading = false;

        var match = re.exec(doc);
        while (match) {
            page.appendItem(plugin.id + ":scrapeChannel:" + escape(match[1]) + ':' + escape(match[2]), "video", {
                title: match[2],
                icon: match[3],
                description: new showtime.RichText(coloredStr('Description: ', orange) + trim(match[4]) + '\n' + trim(match[5]))
            });
            match = re.exec(doc);
            page.entries++;
        }
        fromPage++;
        return true;
    }
    loader();
    page.paginator = loader;
};

new page.Route(plugin.id + ":scrapeVideos:(.*):(.*)", function(page, url, title) {
    setPageHeader(page, plugin.title + ' - ' + unescape(title));
    scrape_videos(page, unescape(url));
});

    new page.Route(plugin.id + ":scrapeChannels:(.*):(.*)", function(page, url, title) {
        setPageHeader(page, plugin.title + ' - ' + unescape(title));
        scrape_channels(page, unescape(url));
    });

new page.Route(plugin.id + ":start", function(page) {
    setPageHeader(page, plugin.title);
    page.appendItem(plugin.id + ":scrapeVideos:" + escape('/browse?') + ':' + escape('Recent Items (Popular)'), "directory", {
        title: 'Recent Items (Popular)'
    });
    page.appendItem(plugin.id + ":scrapeChannels:" + escape('/channel?a=browse') + ':' + escape('Channels'), "directory", {
        title: 'Channels'
    });
    page.appendItem("", "separator", {
        title: 'Featured videos'
    });
    scrape_videos(page, '/browse?featured=1');
});

page.Searcher(plugin.id, logo, function(page, query) {
    setPageHeader(page, plugin.title + ' - Videos');
    scrape_videos(page, '/browse?q=' + encodeURIComponent(query));
});

page.Searcher(plugin.id, logo, function(page, query) {
    setPageHeader(page, plugin.title + ' - Channels');
    var fromPage = 1, tryToSearch = true;
    page.entries = 0;
    // 1-link, 2-icon, 3-title, 4-marks, 5-description, 6-info
    var re = /<div class="thumbnail_column"[\S\s]*?<a href="([\S\s]*?)"[\S\s]*?src="([\S\s]*?)"[\S\s]*?title="([\S\s]*?)"[\S\s]*?<div class="item_info_column">([\S\s]*?)<br \/>([\S\s]*?)<h4>([\S\s]*?)<\/div>/g;

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var doc = http.request(BASE_URL + '/channel?a=browse&q=' + encodeURIComponent(query) + '&page=' + fromPage).toString();
        page.loading = false;

        var match = re.exec(doc);
        while (match) {
            page.appendItem(plugin.id + ":scrapeChannel:" + escape(match[1]) + ':' + escape(match[3]), "video", {
                title: new showtime.RichText(match[4].match(/hd_video_icon/) ? coloredStr('HD ', orange) + match[3] : match[3]),
                icon: match[2],
                description: new showtime.RichText(coloredStr('Description: ', orange) + trim(match[5]) + '\n' + trim(match[6]))
            });
            match = re.exec(doc);
            page.entries++;
        }
        fromPage++;
        return true;
    }
    loader();
    page.paginator = loader;
});
