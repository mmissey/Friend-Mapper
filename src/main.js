$(document).ready(function() {
    FB.init({
        appId: '215206295317575', // App ID from the app dashboard
        channelUrl: 'https://marc.local/friendmapper', // Channel file for x-domain comms
        status: true, // Check Facebook Login status
        xfbml: true // Look for social plugins on the page
    });
    $("#fbLogin").on("click", function() {
        FB.login(fbLogin, {
            scope: 'user_hometown, user_location, friends_hometown, friends_location, publish_stream'
        });

    });
    $("#fbLogout").on("click", function() {
        FB.logout(null);
    });
    $('#fbshare').on('click', exportAsImage);
    $('.closer').on("click", function(ev){
        $(this).parent().hide();
    });
});

d3.selection.prototype.moveToFront = function() {
    return this.each(function() {
        this.parentNode.appendChild(this);
    });
};


var user = {};
var pathCoords = [];
var projection = null;
var arcGroup = null;
var points = null;
var scale = 1;
var path = d3.geo.path()
    .projection(projection);
var zoom = null;
var tooltip = null;

// //Load the map whenever someone logins in FB
// FB.Event.subscribe('auth.authResponseChange', function(response) {
//     if (response.status === 'connected') {
//         fbLogin(response);
//     } else {
//         $('body').removeClass('loggedin');
//         $('#user').text("your");
//         console.log('User cancelled login or did not fully authorize.');
//     }
// });

// This example was created using Protovis & jQuery
// Base64 provided by http://www.webtoolkit.info/javascript-base64.html
// Modern web browsers have a builtin function to this as well 'btoa'
var exportAsImage = function() {
    var svg = $('svg')[0];
    zoom.scale(1070).translate([460, 250]).event(d3.select('svg'));
    var serializer = new XMLSerializer();
    var str = serializer.serializeToString(svg);
    var canvas = document.getElementById('svg-canvas');
    canvg(canvas, str);
    PostImageToFacebook(user.authToken, $('#shareText').text());
}

var fbLogin = function(response) {
    if (response.authResponse) {
        user.authToken = response.authResponse.accessToken;
        $('body').addClass('loggedin');
        console.log('logged in. Getting friends.');
        FB.api('/me', function(response) {
            $('#user').text(response.name + "'s ");
            getFriends();
        });
    }
};

var getFriends = function() {
    FB.api('/fql?q=' + escape("SELECT name, uid, hometown_location, current_location FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1=me())"),
        function(response) {
            drawMap();
            mapFriends(response.data);
        });
}

var hidePaths = function() {
    arcGroup.selectAll("path").style('visibility', 'hidden');
}

var lineTransition = function lineTransition(path) {
    path.transition()
    //NOTE: Change this number (in ms) to make lines draw faster or slower
    .duration(5500)
        .attrTween("stroke-dasharray", tweenDash)
        .each("end", function(d, i) {});
};

var tweenDash = function tweenDash() {
    var len = this.getTotalLength(),
        interpolate = d3.interpolateString("0," + len, len + "," + len);

    return function(t) {
        return interpolate(t);
    };
};

function mapFriends(data) {
    var total = 0;
    var svg = d3.select('svg');
    var cityQueue = 0;

    $.each(data, function(index, value) {
        var curr = value.current_location;
        var home = value.hometown_location;
        if (value.current_location && value.hometown_location && (value.current_location.name !== value.hometown_location.name)) {
            total++;

            var currPoints = projection([curr["longitude"], curr["latitude"]]);
            var homePoints = projection([home["longitude"], home["latitude"]]);
            if (currPoints && homePoints) {
                placePath({ //Creates the circles and path
                    x1: homePoints[0],
                    y1: homePoints[1],
                    x2: currPoints[0],
                    y2: currPoints[1],
                    from: home.name,
                    to: curr.name,
                    name: value.name,
                    uid: value.uid
                });
            }
        }
    });

    $('#pathCount').text(total);

}

function placePath(data) {
    var pathColor = "#333333";
    var group = arcGroup.append("g").attr({
        'class': 'path'
    })
        .data([{
            name: data.name,
            from: data.from,
            to: data.to,
            uid: data.uid
        }])
        .on('mouseover', function(d) {
            var sel = d3.select(this);
            sel.moveToFront();
            sel.selectAll('circle').attr("r", 5 / scale)
            sel.select('path').style({
                'stroke-width': 3 / scale + 'px',
                'stroke': pathColor
            });

            $("#infoPic").css('background-image', 'url(http://graph.facebook.com/' + d.uid + '/picture)')
            $("#name").text(d.name);
            $("#home").text(d.from);
            $("#curr").text(d.to);
            $("#info").show();
        }).on("mousemove", function(d) {
            return tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        }).on("mouseout", function(d) {
            var sel = d3.select(this);
            sel.selectAll('circle').attr("r", 2 / scale)
            sel.select('path').style({
                'stroke-width': 1 / scale + 'px',
                'stroke': '#666666'
            });
            $("#info").hide();
        });
    group.append("path").data([{
        type: "LineString",
        coordinates: [
            [data.x1, data.y1],
            [data.x2, data.y2]
        ]
    }])
        .attr({
            d: path,
            'class': 'arc'
        })
        .style({
            stroke: '#666666',
            'stroke-width': '1px',
            fill: 'none',
        }).call(lineTransition);
    //Home Location
    group.append("circle")
        .attr("cx", data.x1)
        .attr("cy", data.y1)
        .attr("r", 2)
        .style("fill", "#FF0000");
    //Current Location
    group.append("circle")
        .attr("cx", data.x2)
        .attr("cy", data.y2)
        .attr("r", 2)
        .style("fill", "#000077");
}

var cityToColor = function(city) {
    var color = "#";
    for (var i = 0; i < 3; i++) {
        color += city.charCodeAt(i)
    }
    return color.substring(0, 7);
}

var drawMap = function() {
    var width = 960,
        height = 500,
        centered;

    $('svg').remove();

    projection = d3.geo.albersUsa()
        .scale(1070)
        .translate([width / 2, height / 2]);

    zoom = d3.behavior.zoom()
        .translate(projection.translate())
        .scale(projection.scale())
        .scaleExtent([height, 8 * height])
        .on("zoom", zoomed);

    tooltip = d3.select("body")
        .append("div")
        .attr('class', 'tooltip')
        .style("visibility", "hidden");

    var path = d3.geo.path()
        .projection(projection);

    var svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);



    // svg.append("rect")
    //     .attr("class", "background")
    //     .attr("width", width)
    //     .attr("height", height);


    d3.json("json/us.json", function(error, us) {
        g.append("g")
            .attr("id", "states")
            .selectAll("path")
            .data(topojson.feature(us, us.objects.states).features)
            .enter().append("path")
            .attr({
                "d": path,
                "fill": "#AAAAAA"
            });

        g.append("path")
            .datum(topojson.mesh(us, us.objects.states, function(a, b) {
                return a !== b;
            }))
            .attr("id", "state-borders")
            .attr({
                "d": path,
                "fill": "#AAAAAA",
                "stroke": "#FFFFFF"
            });
    });

    var g = svg.append("g").on("click", clicked).call(zoom);
    arcGroup = svg.append('g');
    points = svg.append("g");

    function clicked(d) {
        // zoom.scale(1070).translate([460,250]).event(d3.select('svg'));
    }

    function zoomed(d) {
        var x, y;
        var diff = [];
        scale = d3.event.scale / 1070;
        x = width / 2;
        y = height / 2;
        projection.translate(d3.event.translate).scale(d3.event.scale);
        arcGroup
            .attr("transform", "translate(" + (d3.event.translate[0] - x * scale) + "," + (d3.event.translate[1] - y * scale) + ")scale(" + scale + ")");
        arcGroup.selectAll("path").style('stroke-width', 1 / scale + 'px');
        arcGroup.selectAll("circle").attr('r', 2 / scale + 'px');
        g.selectAll("path").attr("d", path);
    }
}


    function PostImageToFacebook(authToken, msg) {
        var canvas = document.getElementById("svg-canvas");
        var imageData = canvas.toDataURL("image/png");
        try {
            blob = dataURItoBlob(imageData);
        } catch (e) {
            console.log(e);
        }
        var fd = new FormData();
        fd.append("access_token", authToken);
        fd.append("source", blob);
        fd.append("message", msg);
        try {

            $.ajax({
                url: "https://graph.facebook.com/me/photos?access_token=" + authToken,
                type: "POST",
                data: fd,
                processData: false,
                contentType: false,
                cache: false,
                success: function(data) {
                    console.log("success " + data);
                },
                error: function(shr, status, data) {
                    console.log("error " + data + " Status " + shr.status);
                    alert("Couldn't share the image. Probably because you didn't give the right permissions");
                },
                complete: function() {
                    console.log("Posted to facebook");
                    $('#fbshare').text("Image Shared!").css('pointer-events', 'none');
                }
            });

        } catch (e) {
            console.log(e);
        }
    }

    function dataURItoBlob(dataURI) {
        var byteString = atob(dataURI.split(',')[1]);
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], {
            type: 'image/png'
        });
    }