$(document).ready(function() {
    FB.init({
        appId: '215206295317575', // App ID from the app dashboard
        channelUrl: 'https://marc.local/friendmapper', // Channel file for x-domain comms
        status: true, // Check Facebook Login status
        xfbml: true // Look for social plugins on the page
    });
    $("#fbLogin").on("click", function() {
        FB.login();

    });
    $("#fbLogout").on("click", function() {
        FB.logout();
    });
    var time = new Date().getTime();
    $.get('json/cities.json?time=' + time).success(function(data) {
        cities = data;
    });
});

var cities = {};
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
//Load the map whenever someone logins in FB
FB.Event.subscribe('auth.authResponseChange', function(response) {
    if (response.status === 'connected') {
        fbLogin(response);
    } else {
        $('body').removeClass('loggedin');
        $('#user').text("your ");
        console.log('User cancelled login or did not fully authorize.');
    }
});


var fbLogin = function(response) {
    if (response.authResponse) {
        $('body').addClass('loggedin');
        console.log('logged in. Getting friends.');
        FB.api('/me', function(response) {
            user = response;
            $('#user').text(user.name + "'s ");
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
    var new_cities = {};
    var cityQueue = 0;

    $.each(data, function(index, value) {
        if (value.current_location && value.hometown_location && (value.current_location.name !== value.hometown_location.name) ) {
            total++;
            var curr = '';
            var home = '';
            var currPoints = 0;
            var homePoints = 0;
            var currPromise = true;
            var homePromise = true;

            curr = value.current_location.name;
            home = value.hometown_location.name;
            if (!cities[curr]) {
                cities[curr] = "waiting";
                cityQueue++;
                currPromise = getCoordinates(curr); //get lat,long
            }
            if (!cities[home]) {
                cities[home] = "waiting";
                cityQueue++;
                homePromise = getCoordinates(home);

            }
            $.when(currPromise, homePromise).done(function(a1, a2) {
                currPoints = projection([cities[curr].long, cities[curr].lat]);
                homePoints = projection([cities[home].long, cities[home].lat]);
                if (currPoints && homePoints) {
                    placePath({ //Creates the circles and path
                        x1: homePoints[0],
                        y1: homePoints[1],
                        x2: currPoints[0],
                        y2: currPoints[1],
                        from: home,
                        to: curr,
                        name: value.name,
                        uid: value.uid
                    });
                }
            });
        }
    });

    $('#pathCount').text(total);

    function getCoordinates(city) {
        var api_key = "Fmjtd%7Cluubn9612u%2C2x%3Do5-907gq0";
        var url = "http://www.mapquestapi.com/geocoding/v1/address?key=" + api_key + "&location=" + encodeURIComponent(city);
        // var url = "http://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(city) + "&sensor=false";
        return $.get(url).success(function(rsp) {
            //MAPQUEST
            new_cities[city] = cities[city] = {
                lat: rsp.results[0].locations[0].latLng["lat"],
                long: rsp.results[0].locations[0].latLng["lng"]
            }
            cityQueue--;
            if(cityQueue === 0 && (Object.keys(new_cities).length > 0)){
                $.post('cityCoordinates.php', {
                    newCities: new_cities
                }).success(function(){
                    console.log("Thanks for adding " + Object.keys(new_cities).length + " cities!");
                });
            }
            //GOOGLE
            // if(rsp.status !== "OVER_QUERY_LIMIT"){
            //     cities[city] = {
            //         lat: rsp.results[0].geometry.location["lat"],
            //         long: rsp.results[0].geometry.location["lng"]
            //     }
            // }
        });

    }

}

function placePath(data) {
    var group = arcGroup.append("g")
        .data([{
            name: data.name,
            from: data.from,
            to: data.to,
            uid: data.uid
        }])
        .on('mouseover', function(d) {
            d3.selectAll(this.childNodes).attr("r", 5 / scale).style('stroke-width', 3 / scale + 'px');
            $("#infoPic").css('background-image', 'url(http://graph.facebook.com/' + d.uid + '/picture)')
            $("#name").text(d.name);
            $("#home").text(d.from);
            $("#curr").text(d.to);
            $("#info").show();
        }).on("mousemove", function(d) {
            return tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        }).on("mouseout", function(d) {
            d3.selectAll(this.childNodes).attr("r", 2 / scale).style('stroke-width', 1 / scale + 'px');
            $("#info").hide();
        });;
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

    group.append("circle")
        .attr("cx", data.x1)
        .attr("cy", data.y1)
        .attr("r", 2)
        .style("fill", "blue");
    group.append("circle")
        .attr("cx", data.x2)
        .attr("cy", data.y2)
        .attr("r", 2)
        .style("fill", "red");
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



    svg.append("rect")
        .attr("class", "background")
        .attr("width", width)
        .attr("height", height);


    d3.json("json/us.json", function(error, us) {
        g.append("g")
            .attr("id", "states")
            .selectAll("path")
            .data(topojson.feature(us, us.objects.states).features)
            .enter().append("path")
            .attr("d", path)

        g.append("path")
            .datum(topojson.mesh(us, us.objects.states, function(a, b) {
                return a !== b;
            }))
            .attr("id", "state-borders")
            .attr("d", path);
    });

    var g = svg.append("g").on("click", clicked).call(zoom);
    arcGroup = svg.append('g');
    points = svg.append("g");

    function clicked(d) {
        console.log(d);
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