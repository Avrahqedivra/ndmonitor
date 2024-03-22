cookieSettingsName = window.location.hostname+"_ndjson_settings"
settingsValidity = 5	    // 5 days
settings = [ { config: { "theme": "theme-dark", hidetg: false, "last": 0 } }, { "map": { "zoom" : 6.5 } }, { name: "openbridges", "open": true }, {"name": "masters", "open": true }, { "name": "peers", "open": true }];

// localStorage.setItem('theme', themeName)
// localStorage.getItem('theme', themeName)

var zoomValue = 1

var names = []    

names["Andre"] = "André"
names["Francois"] = "François"
names["Herve"] = "Hervé"
names["Jerome"] = "Jérôme"
names["Jerôme"] = "Jérôme"
names["Stephane"] = "Stéphane"
names["Irenee"] = "Irénée"
names["Regis"] = "Régis"
names["Gerard"] = "Gérard"
names["Jean-Noel"] = "Jean-Noël"
names["Remi"] = "Rémi"
names["Clement"] = "Clément"
names["Frederic"] = "Frédéric"
names["Jeremy"] = "Jérémy"
names["Jean-Francois"] = "Jean-François"
names["Gregory"] = "Grégory"    
names["Anne-Cecile"] = "Anne-Cécile"
names["Mickael"] = "Mickaël"
names["Theophile"] = "Théophile"
names["Sebastien"] = "Sébastien"
names["Sbastien"] = "Sébastien"
names["Raphael"] = "Raphaël"
names["Cedric"] = "Cédric"
names["Rene"] = "René"
names["Nathanael"] = "Nathanaël"
names["Joel"] = "Joël"
names["Jeremie"] = "Jérémie"
names["Jerã´me"] = "Jérôme"

function adjustMenuLayoutStyle(f) {
  siteHeader.style.transform = "scale(" + zoomValue + ")"
  siteHeader.style.marginTop = isFixed ?  "3.3rem":"0"
  menubar.style.position = isFixed ? "fixed":"relative"
  lockbutton.classList.remove(isFixed ? "fa-lock-open":"fa-lock")
  lockbutton.classList.add(isFixed ? "fa-lock":"fa-lock-open")
}

function initMenubar(disabledMenuPattern) {
    lockbutton = document.getElementById("lockButton")
    menubar = document.getElementById("menubar")
    siteHeader = document.getElementById("siteHeader")
    isFixed = true

    lockbutton.addEventListener("click", () => {
        isFixed = !isFixed
    
        adjustMenuLayoutStyle(isFixed)
    })
    
    adjustMenuLayoutStyle(isFixed)


    /**
     * disabledMenuPattern is like '--X----------X--'
     * all the menus corresponding to a minus will be disabled
     */
    if (disabledMenuPattern != null) {
        for(let i=0; i<disabledMenuPattern.length; i++) {
            if (disabledMenuPattern.charAt(i) == 'X') {
                var el = $(`#menubar ul li:nth-child(${i+1})`)
                if (el.prop('tagName') === 'LI')
                    $(`#menubar ul > li:nth-child(${i+1})`).addClass('menudisabled')
                else {
                el = $(`#menubar ul div:nth-child(${i+1})`)
                    if (el.prop('tagName') === 'DIV') {
                        $(`#menubar ul > div li`).addClass('menudisabled')
                    }
                }
            }
        }
    }
}

String.prototype.capitalize = function (lower) {
    return (lower ? this.toLowerCase() : this).replace(/(?:^|\s|['`‘’.-])[^\x00-\x60^\x7B-\xDF](?!(\s|$))/g, function (a) {
        return a.toUpperCase()
    })
}

function zoom(v) {
	switch(v) {
		case -1: zoomValue -= 0.10; break
		case  1: zoomValue += 0.10; break
		default: zoomValue = 1; break
	}

	document.getElementById("siteHeader").style["transform"] = "scale(" + zoomValue + ")"
	document.getElementById("siteHeader").style["transform-origin"] = "top center"
}

function enhanceNames(name) {
    if (name != null && name != "") {
        name = name.replace(/None/g, "")

        if (names != null && names[name] != null)
            return names[name].capitalize(true)

        return name.capitalize(true)
    }

    return '-- UNKNOWN --'
}

function getTgTableState(name) {
    for(let i=0; i < settings.length; i++) {
        if (settings[i].name != null && settings[i].name == name)
            return settings[i]
    }

    return null
}

function createCookie(name, value, days) {
    var expires

    if (days) {
        var date = new Date()
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
        expires = "; expires=" + date.toGMTString()
    } else {
        expires = ""
    }
    
    // document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + expires + "; path=/"
    document.cookie = name + "=" + value + expires + "; path=/"
}

function readCookie(name) {
    var nameEQ = name + "="
    var ca = document.cookie.split(';')
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i]
        while (c.charAt(0) === ' ')
            c = c.substring(1, c.length)
        if (c.indexOf(nameEQ) === 0)
            return c.substring(nameEQ.length, c.length)
    }
    return null
}

function saveSettings() {
    themeSettings = document.documentElement.className    
    
    if (document.getElementById("openbridges")) {
        var ob = document.getElementById("openbridges").style.display != "none"
        var ma = document.getElementById("masters").style.display != "none"
        var pe = document.getElementById("peers").style.display != "none"

        settings = [
            { "config": { "theme": themeSettings, hidetg: hideAllTG, "last": Date.now() } },
            { "map": { "zoom" : (map != null) ? map.getZoom() : 6.5 } },
            { "name": "openbridges",    "open": ob, "colspan": $("#theadOpenbridges tr th").length }, 
            { "name": "masters",        "open": ma, "colspan": $("#theadMasters tr th").length }, 
            { "name": "peers",          "open": pe, "colspan": $("#theadPeers tr th").length }
        ]

        if (tgorder != null) {
            tgorder.forEach(tg => {
                var tgName = "tgId"+tg
                var tgId = "hblink"+tg
                if (document.getElementById(tgName) != null) {
                    var visible = document.getElementById(tgId).style.display != "none"
                    settings.push({ "name": tgId, "open": visible, "colspan": $("#" + tgName + " tr th").length })
                }
            });
        }
    } else {
        settings[0]['config'] = { "theme": themeSettings, "hidetg": settings[0]['config']['hidetg'], "last": Date.now() }
    }
    
    createCookie(cookieSettingsName, JSON.stringify(settings), settingsValidity)

    // alert("Sauvegarde effectuée");
}

function eraseCookie(name) {
    createCookie(name, "", -1)
}    

function adjustTheme() {
    if (themeSettings == "auto") {
        var hr = new Date().getHours()
        // choose dark netween 10PM and 7AM
        if (hr > 22 && hr < 7) {
            if (document.documentElement.className != "theme-dark")
                document.documentElement.className = "theme-dark"
        }
        else {
            if (document.documentElement.className != "theme-light")
                document.documentElement.className = "theme-light"
        }
    }
}

function applyConfig() {
    for(let i=0; i < settings.length; i++) {
        var tbs = settings[i]

        if (tbs.config) {
            themeSettings = tbs.config.theme
            if (hideAllTG = tbs.config.hidetg)
			    $("#insertPoint").hide()
		    else
			    $("#insertPoint").show()
    
            if (themeSettings == "auto")
                adjustTheme()
            else
                document.documentElement.className = themeSettings
        }
        else if (tbs.map)
            currentZoom = tbs.map.zoom
        else if (tbs.open)
            $("#"+tbs.name).show()
        else
            $("#"+tbs.name).hide()
    }
}

function getConfigFromLocalStorage() {
    map = null
    themeSettings = "theme-dark"

    // retrieve settings
    if ((cookie = JSON.parse(readCookie(cookieSettingsName))) == null) {
        cookie = settings
        createCookie(cookieSettingsName, JSON.stringify(settings), settingsValidity)
    }
    else {
        if (cookie[0].config.last == null)
            cookie[0].config.last = 0

        settings = cookie
    }
}

const tgImg64 = []
tgImg64["fdf"]          = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAHgSURBVEhL7ZO/SxthGMfvksvhxRRF7FK6F/oPFOnQ0UEQl4SIdM1S6KJjoRa6lP4ZhZCQoTaKuggtOrm4OUhGKZQSFUMuubvk3n6+5iJNpSK4Sb7w3PP7x/u871ljjPHgYBeLxTfGmOeJPoIUiOO4Xq1Wd/L5/Ew6nV5Fn8Js4DYwyGeEHrXb7cN6vf5TecQ+xr6G/5H0v3GVZMzvFHKfoAgKkUOMwZCICeRXQiaTMdJp3kXtwn1i6B8vIX/N5XLHHOKtYoFyLom/gJ//Q7Jd2nzuhUKhMO84zi7NrTAMt9nOQuK6FQ5TvoDPDlTLg1wJKtTv939VKpU96f+D67o2p7ZEoKNPqVTKtlqtl2zE5dQp6uTY6NUhkwF/yPiZ5C0RgetQHn8B+zL8lYJvAw11XSPwff8JdTZUE/83mr4e1u31eivYnjpM1EWxWJem+VQul78M0u8GivrJafVwHHH0mEY+w2fxn1B/qVar6Q1dwyFgImmqFUwm9hvgpeoKnlEoQwMjm2RyFj3PU1M1bMnOQ9T6PdXtdDqTIIt5pDG5qcMoivZFDHGa2G+AqacptIq4TlFdyQdsH+Fz/EqbQRC8p/k7/Haz2YyI+c5Q+9gOGo2G7ldXItJW0tAYYzwoWNYfvpcBno5jKQAAAAAASUVORK5CYII="
tgImg64["brandmeister"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAOSSURBVEhL7VRNaFxVFD73572ZTH6KzAR/OguRWotd2IW6qT/4s9GFu6wMXURIEUTRtiCKhECF2o0bcaNoagNdJCjFuhBaaKVFQxEJxjqmOhpq0DoyIWnmvXnv3Xdvv/PezEjNCK5cSL/hcO45557fe+bRTfxXEB1+A8bGxtTo6OhAR+whCAIzMzPT5jPfqVarfmYARkZGkunpacPnqakpXa/XC8PDw1n8RqMRzs3NpXzuQnf4DahUKnva7fbzaZoqgIQQ5HKsjo+Pn4miaGFwcHDHxsbGPmst28Xa2toCXOdBbmVl5Rmt9VOtVktJKalYLH4A/XmO3UXfjicmJp6L4/h9DgrHLxDkV2PMThRyPwpZhe4AkgvP805A1y3sB7g+VCgUTBiGF+BzL/tz4cCrs7Ozb/GhC9nhW4BAWUAEfxfBX0ayD7llmLaDPQBbJoIQ3zrIO3D3Cdx9GMm4yCxGh7Y0+I+JGeyMzo4i8Dl0fATJOdtFjPkouObCYPsZ9D1sKkmS/bj3IvQadp5AmEfair6JESTjncBXEGQRvAaegkaxZLu5Y7ajuE3YjkFvQY+BnoQuhO0E9DyhvuibGA4Z5wLwZm8PDQ3tL5VKU9AHGOOd4Adh85GE73jgn0F3me8zIekCOj8P3l3efzfqzcgZkzqKk5RaQfRCs7nxDvjrWLUSdOthQqeuRS5I8XSJJV0ul5cTp49hv8kKSbH0jjeda+CsWY76jLxXSfun+bsT2/TJL7mTny/vrf3YmORR2dRZQ46Us8InGZa3Fc89/eBtn3y1uLp7+Wr4khT0++Qj1Te+XAluuXDpz4MyMm5vxXuzsR7437XVa1ILuV2r956t0ELiFdT6tnv+uO/QoVYvcbB4+FNfNh93MbbGE8YpZcjgjTQZwkpRG///2rKkJNExiUFNNkFSdCK1MeRbLUP9y+Y1c+Zbic6HsMiukKYtIa1LhCraVPiuMCCvVndN3vXR2fle4uTrV87qgeBRauN9WYtcGbBAhHG5EB+sWo1EEue6v8OTZOstEqcuwRcyu+WWHCz4mn67fde+Oz5eOt57YyypoQQJHBLjfYn3C4RdzWSHhq2FNwhTzwlvnBGfYU+sJMNFcVQwmP6iTCFJSZFtLqQc5psDp5UI8bGIKPvWMDpf11RhOUOsyOUaqSjuqntQ+KVwiushqdNL5Pf8cs5QrPN9at6682L55NKVXHsT/18QXQcLFQTYgC240wAAAABJRU5ErkJggg=="
tgImg64["c4fm"]         = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAJ0SURBVEhL7ZO9axNxGMdzd+HOQ6uGgkZskYJLYyMEaXCSgIIgOAbyQmJWpSnEQXAo6eDm0sFNyCBC8h8ogoOI6CBVGhHUamwTTaw1hrxecpecnwtXJVKd3MwDD9/n5ft8n/v97s4xtrH9f5ZOp0U7/KsFg0EJl+10xCwN0zQFOx3aSLJjCKhOp3OZ8Ci+LQiCJsvycqvVUqgvUTuF57PZ7GI4HF4hPgLnMSiBFZZcxd8bhrEgSdKKKIqzg8Hgci6Xew5naLueBnG/qqrXGH5Nepuh+7qun6P+lPgsYgFwNhaLzcBZxOdx6xCPWDavKIqf3A/vOktjxCeIK0Nx2yQbR8zn851EwMfQKkMXOUWVcoFlz6itEXuo3aK3BzyPL3D6O/l8vuL1eq8wW4P7kP5e3An/Af27lvaOCZFIxAVegKCBPa5U6Pf7Iic8xpID1HVwHWywoEusIDzNCcrwXOQu6p+JVdBg4RS9HreziYZIfhjdPr0aKINt8J0UCATMZrPZItmAPAm6IX+FsAZuIPIGcZ16keUtvE3NeqcGD/kSToGldWY/UpPhNuGswp8AC9TW8TrepFfGt5j5NvJxhUKhmxDu4ZdISwzWWGIS77P65JvAIfyVtZBlp8EZxLZZrlA/jqvkT+Bat0UoSpYOvCm+mxuZTKYB59c7TiQSB7nCM4g1QG5Jf4FYq9vtVvmav3Q6HZ26dSI3D1NHbKLdbhuMfuDGHAh/ov+WvgmWe73elqZpNfLv8DTmq8ViMV8qlayZERNSqZQajUb32/kfLR6PTyaTScXj8bjn5uamKf08AA80vEX7///9d9319x3b2P6hORw/AL9/aMgJov9vAAAAAElFTkSuQmCC"
tgImg64["dmr"]          = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAOTSURBVEhL7VRbaFRHGJ7LOWf3xGw0aJNVkYAX4gUL+lBopRJ98fIQ1Eo2wSCBphisWowieRAiGtBI8uCDiPoSkWwuiiAGSos3EC8oPphIimvYeqvZLJrEqOvZPWdm+s3mpHH75LPkg3//+3wz889ZMoWvHtTXWVRXV68XQsyGmT8eIRlIb0dHx93GxkYWi8W2wr8O/00266OmpiaYTqfLPc97ZBjGSinlDEqp6acJYi7WvY2+Xj80SayUopWVlY/RUAL3wXiU6OZFiD1G/gjsK9ADtm2vaWtrG9UFZWVlRnFxcQ9jbB0I93HOW6HvI5XUeR+zECvBBr6PRqPPdcDIhj8DCv7s7u7e4rukqqpqGchuwWyCToLgW8dxzsMvh6hwOHwS+kf0pbBBDzZBzU4QPNS2Bg40Bzl9mFmQLPH/T9yHgoHOzs5NfjgLxG9ArYK8QN1xSDNOdg56CLFa9ByGfQp2A6QFfhwbGdUb0RtCbRGueiY29APWfokawvTPZ6AolL6dBeZeikWXw+yHppZl3TJNcysW/Q1+ExbdhpY+2BMzNWBfgu6ArADZavhncc1rJ0g1cojhcM7Y2spIpDsSiVysqKi45rruPUbpK67UQapUPnHdgvb29mtEiB2or4V9D8QhbECPjZuGoW/xcldX1wnqut+h5y+Qb0NsmuaYQM6rjmzfvht3Ph9i62ETSt9j8b60bd90Cgu9UCLxsxUIRJ2lSxMX9u5NIy/Lm5tDgXh8Hhsb26xM8w6ubAPqox8WLPj7akPDu59++XWZlflQK6R8kbLt0z1nzqQ0Vw7xxpaWkpSUhTPM0OjHAitDMxnvj7q6txuPtpZ6XqrQ4cFPYSbGbCE+Dbu0WErhepKFgvk8+baoaGhmcmQhC3LlDA+bjpSBNN6qMOyMsCxJHcdOu6n+vmPHRjRXDnFw14EmT8lSppTIBjilehbjQ1cK5ZQoiB+RRBlEMVyxNBllyElkqYT1kVOW4IQOBSh9WWBaTxeHpz/t2b//v+8/h5jtrO+Xdt4SzM+PAJqHgV6Ltn3gSglLO+CUbzDHBEifccafcEJigpLneZwOBvLMwcWWNXLz0CGBXmx8ErnEdfW9cpq9nAh9IkV0KRUutEriZSZwtH8UYwMBxp4oKQcsYrz+JuANxlpbc/7JvgSTxPpT2VV/TjJexCV5hpcc51TGBVGvpnMzsWL+3MHf9+zB2KYwhS8BIf8CIgGxYapZiSkAAAAASUVORK5CYII="
tgImg64["dstar"]        = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAKqSURBVEhL7VNPaNJhGP7pb+qcc/536gY552FtaiN2MtZBDZSCOlm7jIU26hTSYsd16CZIyIzKQyQoHUKsg7XqFLLVaFEwZMFkMtuEwv/OOZzao/s16NIWSHTwgY/v+97v/b7nfZ/3/Yg2/iu43W7J6uoqk9q2BHRq/uc4ktjj8ci4XO51jUZToUwtwZHEXV1d99hsNgvL+oGlNfgjsd/vt/X29l4WCoXvKBMZCATEi4uL6qWlJWW9XmdT9r8GjZoJr9erq9VqZ+l0ejcGC5Ds7+9P8vl87s7Ozsf+/v5cT0+PBNl/g/15uVx+FYlE9lKplBLnZZTCUCqVxNVq9SKPx3uaz+eD8LtLo9HoDofjktPpfAb7D9hYe0AHxUvgwi4ITzAYDBscBCRJEtFolMjlcvdBosKFMyaTaRqun/v6+tZ0Oh3HarUGFApFtFKp6GB/23zomDjM+Bd8Pp+0s7PzNWQ8FY/HV2ZnZ8dmZmauqVSqyXQ67UbGwxilTCbzCQHeRoBbUEo/NDR0AQpoENRVu93eyPAB1NIiKDIWi00NDg6GkVgY+1H0zWOS4juExWIxQ9IbUIOEXBsGg4EEwRWlUumE3C+xXkYZ3kMJC9YiBLiLfffIyMij7e3tm2Kx+M34+PhJiUQygOee4Ow03mMi2A6tVnsH96aLxaL3t4zxdUbRSB/g9B2RfQHR+Ww2ewt1emE2m9cptyaCwaAIZ2MoUQ2kK3q9Ph0KhYalUukGlFJNTEys4V51YWFhoFAosAQCQcFoNG6Fw+FhEG8eEs/Pz4s4HM4yRhLbKblcnpLJZF/VarW9QXzg1To0v5PL5WIzmcyHqFejQc6hadYhVwYN5Uomk9yGT6tBm5ubo+Ov2lELhs1m81D2JhKJhBC15iDrBGVqo41jgiB+AkC+Eln6OrgyAAAAAElFTkSuQmCC"
tgImg64["freedmr"]      = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARlSURBVEhL7ZVbTBxVGMfPmZmd3Z3dZVkol0Vk5SKWq5GqRNRCqLVtoAWMaENAEYxACNZIQzD1AbNICwRslAq2SkNp5NJuCiFQTNNgC5FGTIi25bJspNKyCuwu22VvszM748w64cEb6EOf+nuYM9//nPP9z3fOyQx4yJ9hr1iUJ78+kyyEPnQzP2v6tdpIIfQxMjIQ3/BpZ5AQbgkitA+cfzWevjTtn0N0DH6PGg8IEphs1MbtLH9jFJ2YiBckUF5zel9dx4+D1tX7OwRpS/7R2Hxjwe9Y4FCfQbqe7qLtHl4bb2uLVX3VpZPNzO4kWdanvfdhZ+bQ9cW+hUVTmD/BeHltO/yt8drAnKKY7OmdF5leJkkSOORS9/LJroigU6d0hN4QRzIMCEdtznfre9IujRn6l5dtSgxFae5GbPvo/jJwtf+WvER1oXcWNx1wu91AQuPkU2u4zNmm1Unn5hIpbgylIFbHE7NSdJdvXvjlrjUQiFAQoMRWSHLD+keWrYFC64P9gSUOObS86UHeVAZlnj2LyvNVx3t2EQv6JymWBVRooHk4p7Cv9bYs13jXGgYQFEQ/Kvk1LYZ5rbuzZUJItSWbxmNjY/JP0PHzsyJzjtPtAv6AALsNinPvN/Q9IbqjT/WyALjCQh2jB1/vPnHbb69pyRINUAhK9hKZnaebxoQ022ZzqzvgZNMcbvGZBiAykLgS0Hrk+MVQfFGfSnOm9tAQcnJ/dmPrvP+LPlMEguhHJCZh+n9m09jCOuNdXg8IwOQgyoCcKFl/p9FrW4nh+xxhau/NXU+XdSXk9bnWbTEAQhAVLrXsToKv/p9qeTaNPRB4VSI5iDVgrYOlLR8g5SEkCyDqDAkG08+mVhUOD3elmJdw7mywiDCxLT0OFpxtb76em1sZmFVQoRLSgIqKClVRUZGMf6+pqVHU1taqijMyJEfz8oI/LixUFyUn+/ow/sETzEglfnryC91bzdV8rDIaRa7HIukZpbK6eGCgndcokhU/rlGsapSut8+eafqmoKy+kwEgg4AsPFym/daPXWlMSIg9R5KUcWpqqlSj0fQ6SVLkUiguBxFEudvjAUnJye7amJi6zYojZ+i6osLmSiEEgXq9/ae0tOI3r15tFSTgHyhZ2pMozu7vbh7hY4ghCffNK/rflhc/QiD2io3CK0UiUTSO4/uysrL2c+1LEMIYBMIoB0WJbszPl5E0bcVRtBrm5+eHUhTVArysmKQ8RlyMK1iWVXEToIWmPw+WSBJols5kaJZ0Omztfn7ybIZBI0nSdUcZ/ly63WoZHr742bHDZfVDLL0RmpoQvANCRGO3278jCCLNyzB647Vro2qVqpSrcppm2YiZe/e+5BYDtRiGFVAMfYhhmRe4QtK5y8P/jVK4FRzl+hsokkqlPJ4kqVRehSDiIzRNP8PQFP+tRrxer2/XMEykZiiXlWG8TpvNNqdWq583mUy3uDvBQARBuS1fWzabjVyssW1sXOHnPOQBAMDvpezfz0gJ26gAAAAASUVORK5CYII="
tgImg64["hblink"]       = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAJcSURBVEhL7VM7aBRRFD33zcz+l103UVBBRBQkaEAhxBQJiJ+wGmJiLxiLGAgrgkQRC7tE/MCaaFS0sVALU0QwfYgiVsFKLBRtRaMmLPvLzHuemR3BcouUe4Y77/HmnnvPPTODFlpoYaMguDt0h0sXlDWDwtzL8Bwonr4EMYMw5hYuzr/GzOA2uNYsDFI818wQXh60LOLA79s4vOg2iM1BsdAhJCO98Lyd4VkDYvYjEeljynZM56NYV4+RiZ5C0jnC/GOMo4hH+pGwp/Bh0zM8GnVCZlNQDdUGFMDb/xAdnGveKk4ESi2gVB9DxR1DmVGqn0dl/Rpqbok1jqP8sz0kNgVOLAZ1j1tTQHH4HYpD74NV6wF4dNS31VZbYSFDIVk2yQWhJEdSliUU1S3hj7USVGwSJBEeJ4s5O5CK9iAV6w7WiL254YG4bLKPtk8iat+ALZNBOGoKjjUhtiQg8hXoCN4xKeKv/2AMpfvyr4e9CHMfKf/jWkLU6UXVe0DxLzipcDXQ3lXE7DztHIGoX9y/4v4teaNsqlBVZiT2ZVe//v68oDutH2pLp8FT0KMrSrDMKt1qHOdwD2e1okMudvP8IZ9PUN2yTZuEVrKe+wkX5t4EknwUh88ELhojYfiz7GXlm3w1CpaYj146fdn6HBctNbh7qnCQI+Og1iirOBtOo8o51/gVpUWhhyXyrLHAnCcM5cAKGiTDlg0ILfQFKVKsIECr25GNDSATO4FM5ORqKtVXty27S63Of5Oi/4u1UWKNE4muYZaMDjLH2azM8BhtzKlhBaWgRwstbDyAv/YNyveso+CmAAAAAElFTkSuQmCC"
tgImg64["ipsc2"]        = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAQsSURBVEhL7VNdbFRFFD4z92f37na3Ll37Q4FttRBNLEWTUiitUNQAgj80oDU10lhIlCKNGI0Yk6YRU/wJDyoaiGC0rTWRUNGHpsVgwGqBGLABY0qQFNLWLrTd3e7u3d1778xx9nYh+MCbT6bfzb3nzJnvfGdm7hmYxf8e5NDeqrKAz+hEzpNUQu+0rn6Hsu9zTYkddsmWihxczCIDQ2HStn13/5WW11b5ly80P3AqSh0laCQN/Paarr2xdVfvVOe7K2qKCpV9ioKLkyZemoxAS88f8e5NS7R33C7yMpUgK6xDe/cP2dul2sdLZJ/DrC68W1lpcYgYjH7t1qgx12u0WswygcOlrCys9TvxqaoVi/qXFqU6spysxjDxMyB4USx2NUlC3/Mb51UW5/OjgAx0w+xQKTjEuzplunvm5/KXCLd+Q7SmAn66sXBuMos27DoxGg5rb3OQIJaUjm9oGugCCjIlFKJx+n31ttNPRGLkmM9L7s1Wca1TgWUWo2OXR5xfrWrsb279eWHZkOG65tdYK3CklyfVZ2oaz+yobPjlsdGIYyem5Imh6/mbqhsHXvh91P3itM5Qlc1SOX3esoIaIoJMwB6DBcA4gkvlZX0Hlze7nbg6HCXTsYTUEzdoRW42e7Li/sTg6S+XXYkmlcOhqKdbphiIJ/HP+ldPDtga4jjqX4eMP4NF/sTTPq9C/g5ZvTQdsBgzCJB0MW4zBCxRWHVAhabCm4yRv4IxacuW3T+eX9m4s3Z4XKqNROl+AlxdkIt7nIpexxHjsgQeKFnnyEj8C0c/erje7yXvXR3HjvVNv75PWlo2qxX5wc0lebxjdMo6lqC+bSrj982bEz81doN3Hr+qNbe1VYUAWvmRDx990Os16yzVPHghSK6Xz4G24nzSNDjMm+5yQVVhDn1uZBL36gnyhUPCQIrTdacG9da15doOn4fvCcf44JTuadY0KUT271tT8oAv+pPbwbMZJ9aNlPMT6nF+k8tjZyZj9OM1W0++lVk0HOlcf0+eGT6hyCgTAhMUIS9mSr2fNrzSuLS9K6cSgodUGR5hSIKC7k4w6BtjvtaAFDrrkCxH0pIiVCKKnqIh0v7s4oe0BeoS0TAWpaDwBARpyBjBAmcZi+CYOj49PFMWgJsE2XxnQU4hBECSnXqMhMfPTw+6qYGYkFnIQ93FpZ5SzcO1RByTwaHYRZdDo0qBXCoWI6mUSIhcMi1k5OyGwARnTBc7sEEIqoKjIONxQlHllNr/TDQD2gTEpOgEi6B40mOZagzQ5hBEk4g8wURIF6GgictBweR6OjndR8IKQxi5UFck+ln44mtDqGFakoixsLZ4xr+FtGuH0pkz/kzwJjKEjLWn08jwTdG45NyBClvy1qTA7RJ3woysvTXhpS/DnbNun7m5HHKuqzxqR2Yxi/8UAP8AHEHtRe7WeQYAAAAASUVORK5CYII="
tgImg64["multi"]        = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAALuSURBVEhL7VNLSFVRFF373PtePX+FpYWfiPKXEglCUaCNjEYNmgRBoNSoYfRvkpCVDQocFTWJahI0aSAEoWhQFPUgLEn6aKUVSdlHfc/37j2nte8zGzRtFO5377tnr73uXvvssy8WbMH+O5O5Z2SnsbrOICz1gK+H8P7ZeVQUpyENJKUtzNhiBHV8TmiMdOlEZQNgvggyVR7k8xF8GHbEu1DZ7EMWzSIM4kBeAJn2kR1KI1a/CBg/jLGXJicJXEJTTJC9mQf0BwgvK5YBLuYDA4C96hnbnoDXa2HbNdaF8nIj7gzxvQXwyTERfg61BeQfdAhvF8D0Au6KgWsLTXxfCbw+C9mlvHnhL/iwFuJK0rBadNjpr2qF2OYAjj88ddbWZKK13FW+hasT5yZgbS3jcB76FZ/B8PQmVO8MgMezDAbwdhzBeJtzwZYwet/eV968sIHfKJDnFvjBcKkJgwNEH0YxYwYFrjGF8IeP2JBi5G4UY14zUeMMwm8Iw+eKd7Cm+xgp4fGso9CblfAGu1FcBCcbviOcdEgMKm9emIk3Q3Q3bioBU831KOEsd8xaMMm7RmCSBzHyVvlWHM8XkwZSRZHkUXx8p7iaj6A+DlnmRJLtGE2nkKiPwZQzlDyOVxPKiYQ5RAm2bo2xkqSbl4X76Yx33TnXQtVxJpYi+Al2wu9CWetZVOxmEUvY4qWF8BfzmTmDiu3E12s+Hse2fHjwnNxTH0a2FsIT5onarBYJzyJYwXY+csvzHhDqo/CJWBDj5LkXJF+LW6/nJ4I7SmbSDhaw33juAg96choBk0uCX8JJCrRoPhbipmAHuMse9Tk2foq+IHYr8mnMC5xCWSXHfw/bneXU+QRnGYrT9yiS5Zqz4qgrcf4ZYozrbQpVRDuid46rJj47xcsFyv/j6zq8cQyfRiPhblQVpZBqYnYTowh3bJTN3YWacE5Ux51XBPyFqVE4eu83roXnIjmfgxjPwDzpwNjXHL5gC/bPDfgFY3E1XGZXT/YAAAAASUVORK5CYII="
tgImg64["wiresx"]       = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAUCAMAAACknt2MAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAMAUExURQUABwEABwkFBwcGCgIFCg0GCgkACAsHCgAIDAAICAYKCgULDAkMDA4ODxwHCxYNCxIMDRoMDAASDQ4SDgwXCw0ZCwsbCggeCwsfDQ0eDw4VFA4SEwMcEQQcEA8YExIfERQeFyQICi8LDTECCD4HDjALCzwJDDAeGA0iDhAhDhAvDwszDA84DwstFxMkFREjEBInEhUgFxcpFhMqERchGRguGQ0yExAzEhE3ERI1FRA/ERU6Fxo6HCk6F0YMDUsKC0oLDFcLClcREG4DCmsGDWMJC2ULDG8ICmsJDG4KDHEBCHUFCXAKDXkNC3kLDHMUEHgfEEMxEkkzHGEhFWknEnQ2GxVFEhNHFRVNFhNIFhRLFhNGGx1CHhRJGgxVFQ5QGxVVFRdeFhhdFhdWGBtTGBdeGBpbGh5ZHR5eHhVnExdhFhpuFhxjHBlgGBxmGhVoGxlpGxtsGxxvHBl8GRp7Gh5/HiJrHiVOJSRIKStILSJSISJVIyBbIihYJyhaKShdKRVxIhl2JSFqISVgLyd3Jyh0KS1yLSp7KihmNi1qOjdhMjdpNix0MTJwMkRJF31CGJYACpwLDaYKDLcDCL8ECrUMC7kJCb8bDoAyDKI6EMQABcUKC80LDNQHCtQLC9QMDNgJC9wLDNoNDs8eDegHCusKCuwMCvcFCfEGCv8GCPcKCvoIDPkKCv8JCv8MC/8KDMMtDsIoF84pEMgpEINsIp52L8VBFNRKHxyFHhiHHRuPHyCJHx+OIhubKCKNJCaNKCCVISSUIyOWJCSbJSWQKSieKDOBMjWEOD6KPjGYMjyeOR+pJiKrIiumKi6tLS++LzGqMTavNz6vOS2wMy20MDW2NTWyN1eTJyrMKDXHNjPePD/fPjDqLzLiMjTgMjXtNDvvPTT8Njr+Oj38PX3DOUD/Pz+bQUq4S1GvVFS6VD/hQT7/QEfQSkLjQ0foSEH/QUT/RUj/R0b/SE38S0n/SUz7TUv/TlTrWVP/UVP/Vlb1WFn/WV3/XGL/ZGn/awAAAIFFmroAAAEAdFJOU////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wBT9wclAAAACXBIWXMAAA7BAAAOwQG4kWvtAAABlElEQVQoU2P4jxNApSzNRf5rRCUmWPz/r1Ddsn9fMkxK/uqD+zeuvHr39tX59PqTF84ePrjbHCpV8/Pz629vemz0THtPXbt89NCeHSVaUKmq35++HpdmZJBq7ok2P3J6187iTFGolNH3J9unTJs2bWMot/KE6ds2bJ4ZBhSFOOPZ1llL165dt36Fmt+6lXM3LZ4hDpOSaO1iVVq4du2adZNU53jwl2Vrg0TBUhE3K+Q4PIFSa1fZCXIzx+aDBCFSSbf1hLkF5gGl1k/l4WK3zkBIxd3SFXJwcFu3FqjRkZPFMgUuxRd4Pch/6XzF2evXr1+7wF7FNk8DJjVx/ZrVa9ctUndaDtS2fu2yvtMHYFKuvv1bAlyUDCuDvZzdfbxDmu7diYRK/Zdt2NsoxMJu0tkhy8goFH/u6cMzMCnjprzdTfLsbLzdL07UtV/8+uHxXWAUgKX0MzKySkvTrQ00617++/vnx5f3j3KhUv8tI8N0rFILiwoi5Muf//r948vjKJgUFIiByZhjl641AWkUKWTw/z8Aa6pmntImAR4AAAAASUVORK5CYII="
tgImg64["xlx"]          = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAYAAACaq43EAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAMJSURBVEhL7VNdSFNhGD47Zz/ONWeby/mDjblg2FhS4UVpwlixUdButHkj1ZYYdDMydpcgAy8GI4YLY4EkORJiq6CtoqsSTakoklUoS1o5KOaczLW56XqOO0lRaIFEhA+8fO95z/t+z/v3EVv4p+ByuaSTk5Nc5nNTQDLnX8eGxG63WyYUCjvVanWWMW0KNiQuLi6+xOfzeVDzBcvmYF3ioaEhc3l5+QmxWPyIMVFer7dsdHRUOTY2Js/n83zG/sdgMSfh8Xg0Kysrh0iS3AbhAdJcLtdeWloqXFxcfFpdXZ0oKSmRovoPsN9Op9P3RkZGMrFYTI7/aYxCm0qlypaXl4+LRKIbCwsLPvjZWSwWabVajQ6H4ybsn2HjZQA2w0sg4AsId3I4HDMctlMURYRCISKRSFwGiQIBB3U6XQdcX1RVVb3RaDSC1tZWb2VlZSibzWpgf7h60W9ireJvGBwc3FFUVPQAbdwzMzPzzGaz7e/q6jqjUCja5+bmXKi4DpKKx+PPkeAFJPgRnTqgUqmOYQS7KyoqTlssFrrCfoxIjaSpcDh8qra2NoDCAkiyHnszQDF8azAYDHq09Cy6QaFd77RaLQUCk1wud6DdQegTGMMTdMIAXYKQpEAgII1G41W89U504H5jY+MuiUSihL0fZHuh00tKYRw9iOtIJpOeHyrG06lHluOo6BMyewmio/Pz8+cxpzt6vX6acVuFz+eTILF90Wi0BkJOTU1dw8U2XPxYKpXW2O3260hG19zcnEKnlBhlvLe391YgEKgD8fs14r6+PgkynIBE8XkSLYvJZLK3SqXSQhMXvH4JXktLix8tn11aWprFGcM+iPx+f4/JZLLC1oCqOVjAi8FgMMTEFJ6T0+nkc7ncKwiiF+Qwlma6qakpjgucqEZI+6yDDOLuQsy4w4Mzg1Hk6B+o0s1ms/WQxPekNFjd3d0k3qoFzhyz2exm7KuIRCJizFqAqiOM6Se0tbWVYREHIDl05hXOGP0soTtQaQP0I3Dj4/vc8PDw60LUFv5/EMRXMoFQY69+EkEAAAAASUVORK5CYII="
tgImg64["fr"]           = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUAgMAAADnxWVXAAAACVBMVEUAI5XtKTn///+i/AH+AAAAFElEQVQI12NgYOBatSo0NIBh6DAATSAu4Xxi9HsAAAAASUVORK5CYII="
tgImg64["zello"]        = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADEAAAAUCAMAAAATIyWrAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAEXUExURfu7YvqhJfqeH/qfIPqnNfqZE/qrPvu5Xfu4W/u5XvuwSfqpOPqlLvqjKvzEd1FRUWtra15eXlNTU/qfIfzFeGxsbP+5Uf2pL/uxSvqdHfqgJPqbF/uvRvuzUPuzT/uyTfuvRfuvR/zFeouLi4qKim1tbZaWlomJiYWLjX+Qlfy1T/u8ZfzCc/u3WvutQ1RUVHt7e0lXXvylK/qnNPqlL1dXV2RkZI6OjlVVVWZmZnd3d5OTk0pPUv6sNvqpOfqdHHV1dX9/f4+Pj2hoaFBRUfqZFHp6el1dXVlZWfqqOnh4eFhYWPqfIvqcG1paWmdnZ4GBgfqhJ2lpafu/a3Nzc5GRkX19fYWFhfqaFvqrPfu3WfqcGgAAAIpsGS0AAABddFJOU///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AOGvnZAAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEySURBVDhPtZFnV8JQDIYLegUVDO49UXFbB+6Bq4gL3Cv//3eY5KZwq0eOeo7Ph+ZNyNPbFg9/y98MLxZXGhrttB5keKYpkUwmiOYWY3T+ldZUSioZaWerLWJABts7NDOdfCEj5m6ZLg0MdCNUjZ7ePuynSsaAGRwaHhkd4/G4mUDMTjLUwZQY0zlqZ2Zxbn5hUc8Q+OZL/B6gWGMZfe1XcBXXHINPWJcKec4bsCnGFm7DDvW7sIf7eFA1Dnkpbk0ocHMEx2qc0GlE/lSKGmmOZyywEWCRnyIbNc5tsUaJk+yLcSG/EBHjsmZcXdsYAjca1ChDRRrHuLUxRD4MkUO4472C9jWjZO5tDgl8IqBne3hE/wnxmQcBBYEMfNFXEF7t/HvYcHh7lz+mHp+MH/D/BuIH2WwXIljJzN0AAAAASUVORK5CYII="
tgImg64["aprs"]        = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAMAAADImI+JAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAMAUExURTc1OwAATB0iXDY8SzQzUQ0YbxIWZwcNeAAAcwAAexcFewUadxYSfxwcfDANeCEecTgafQAibgAkeCg7ZzAzbycneTQkei4ycDU3eTs8cVEAW2gRRHwDWUQ+S0oEaVwDZ0wKd1gLcUAacVkac2YDY3EIYXgUZHgjZmYseHUrdCpEcUVDTEFCW19eW0tObV1ebElKfUJBe1pYd2VdYHxOd2JdcG5td2xqfa0AJ6gENr8DOb4ZNscAANoBCdIAF+IOAOIAAOwAAOQADPUBAPoCAPALAPEFHvcgDc0HKMAAN8oWNNYVNN03N+EgKfAnKPczKZkDR5cTTYgFWpYFWIgYWZUTW6sDS7oLSbkZQ6IAUKYQUJkhVLgiS7k9UYUFZYsWZJETZYotY5QiZZQsZpwxYaQpYcAMQcMWRZRWc7BKaq9Xa4ZtarJgb8lMV9pOUelPQ/FGSPJSUMBgXd9oV8Vtcd9ncdh7feJ4aud6eIKDdJKFfAYIhwEDhQALhAEDiQoUiwAThhkYhxUWhBobhRQVihUaihobiwwqjgAkhwAljAEqjRYlhx4jixQrjBg1jwcokgAskhgtkiomhSoshCMkiyQqjCosjC40iTU4iTQ0iS0ukS81kzIzkUYvhDRFhD1CjU9Oj0ZEiEpRgFpXikZJk0dRllZamFRckmhbgnhYhVximGlnimtuhGttinJvgm90jnR2hXl8hWRnm25wnXJ1mnN2lXBuoHR2oIl6j8l5jHiEmoKGipmXhYuNmZqWmaaKloiJpoOEo5WMqYqQq5eWpoaOspaauaSdq5+lvqqmp6Wjrrm4pqeptbKysr27u9eGiMidht2chMWWkt+SkeeMi+ObmN2prMe/oserudCwteSrq7/BvcjGrcjHu97GvuDCqODKu6uswrOuwa2xw7q9x7a1wb7BxrzD0MjIx9LJzM3SxNfZy8fI19HP0c7S0dLS1dLS2tbZ29zb2uPUyeHd3vLS0uji2NTX4eHc4d3i4u3r7OLj4ufq5Pbo4+3v8AAAABqj+M4AAAEAdFJOU////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wBT9wclAAAACXBIWXMAAA7DAAAOwwHHb6hkAAACiElEQVQ4T2P4TyRAUXjs2OED21YZMK09tXXLgSMnoKIQgFB4Zu+6xQu3L5NgYdBe8+4N++QZhpJ6G59BJREKP517//7JWvN3d/fpmpnqrN0rOk1UW/bI+9tn30MVQBTe/XNO0pC7mUOUY/fdPRvXGYvUdHUK6p/+9unjr5+/b4OVgBW+fH1SnFNBvq6aK8i6uLwom1k6LDI4YH/lnqqy87cuP/gDU/h7zZqFtQIeoZ09HRHOFRXOsR2azunqjnmnzG38Lp3Pf/AHpBKo8NlBzpr6aTEu8R1Tu70ddtx09uJOdYmf5Fj47YGzz4sXWWdfn34FUviQjbW6plbG0iWhukHR1VMo1zFEy8tRPsqh4vrnAueSp9OnPxTbCFK4ZYXIpAY1jRCXhM4JwS4R0eGqu+75Odg5Ka/esO+im3tmZzPvVH6Qwq1GjIsyLBIjXOIn9KW5as7oqjtz1eVyhaPGBC7D17ec7WZObZ41E6TwaNPq/TlKYoEuyRPEnLxnzp7WsqrU+es156T+IJPXd3yd5k6dNW0S2DPzXl75+4gzwCW0IcTVir2tsVbBwf/GSkcvds/c+xfswxpamtrmgxX+X5l86LtRUKAqX1BwnEB1dY/81Z1SnPHBcqpqKQFxtbXV1bzQcPzfVbdwRr9Q76z2zvZZ02bNmXFm6cSpnZ1TJ06c0NU+a+q0OSA1YIX/lzQ3t7W0TgGDqVNEJZtB1JQpbVPaeqZMWQpWAlH4/9iyZZuWTq3rmTWtpa5mqsTktrq6mpoZy5YsW7UcogCmEAg+fnjzaHEN57aDh9cLcyw49vzNmw8fnr6BSiIrBIKfzw+vP/X+38fjp97//v3jx2+oMBigKMQN/v8HAL8/Fw7PGZpaAAAAAElFTkSuQmCC"

const flag64 = []
flag64["at"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUAgMAAADnxWVXAAAACVBMVEXtKTnzcHv///9FjJx3AAAAGklEQVQI12NgIAuEQkAAwyoIWEAaA66dLAAA/KEk6+/EHQQAAAAASUVORK5CYII="
flag64["be"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAUBAMAAACUkLs9AAAAElBMVEXtKTkAAAD64ELyZTtUTBZVTRYE41wOAAAAG0lEQVQY02MQFBQUVVJSUmYAASBHZMRw4N4GAFi9EENfoBrcAAAAAElFTkSuQmCC"
flag64["bo"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAUBAMAAACDsiv0AAAAD1BMVEXVKx4AeTT54wBTnSPhZhQzAYZEAAAAIUlEQVQY02NgoDFwQQEODEooQIHqfGMUYMAgiAIEqM0HACBCGM/oCyk+AAAAAElFTkSuQmCC"
flag64["ca"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAMAAADImI+JAAAAM1BMVEX/AAD/MDD/EBD/19f/QED/ICD/r6//////wMD/8PD/oKD/YGD/gID/b2//cHD/UFD/kJAQFQNAAAAAgUlEQVQoz62S2woDIQxEj5doou7l/7+2DwXbwupa2nkIjBwyGAa68oW40vdgKUugmUi2BVAOOGQBjADxFtS8A+xZZ6DW5s8CUJpvVYegAcQ+bBzt3r0bR6fPhzTemPzL+jT7dejhLszPY/I0Yjd3NOJW6xaxhVKoLrbn/2AIvzT8AWsMCOs6h1CtAAAAAElFTkSuQmCC"
flag64["ch"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAANCAIAAAArLKlOAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAFHSURBVChTlVIxTgQxDPTYyR7wlOv5PAW6hpIWCR7CQjaxGWf3CqSjYKSN4sQzHjuL11rl/8ALrEABfs6VWEQNQRiUGe4OU4bcmJkKug9cVE8wXmtosWTWYLqfW5u68nF3z3VXJOHLO0Md4byfhxFSKZlJkYQD3lm8975ubY0AzMLSXsQYEoIhnunph+EVlGndVbWaLSKFtgx41rRbFRpi8MctPdzE27KQ3F02hFIsIKxGmgbl/gR9fdMYgvaUw0K4ze5CjjHcBOvkfMlkh5dS2VKyRU7zCR5i43ruYybLOzsRWaXQIe3lEZxeObsM+HqO1Fuhn8LMA10LOSQ0ymcpH2O+I7VJJT0d8NXl1yTp25XTmn9AqOQcgScBq9tsr+r+7nu+mOWk1GMoNdNNeDrKU2fEOldT3PPiui8NvRf+AyXjSFFWdPcfPqrVgMZwDRUAAAAASUVORK5CYII="
flag64["cl"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUBAMAAABohZD3AAAAFVBMVEUAOabVKx7///9Lc8AQRauQqNjf5vTwpxheAAAAKklEQVQY02NgAAElOGAgzDdG5bumhaDwWZQcUPjMxgakmY/KF0QFg40PAFkJGT1/YYOJAAAAAElFTkSuQmCC"
flag64["co"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUAgMAAADnxWVXAAAACVBMVEUAOJPOESb80RYoeTcGAAAAF0lEQVQI12NYBQELGKjOIAmEQkAAMQwA+9NB7HYGMdMAAAAASUVORK5CYII="
flag64["de"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAUBAMAAADxfUlCAAAAD1BMVEXdAAAAAAD/zgD0igBKAABdJSNsAAAAIUlEQVQY02MQRAMCDLQTcUEDDgz0BMZowIBBCQ0o0E4EAL4AHCF2rs9hAAAAAElFTkSuQmCC"
flag64["ec"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAMAAACtdX32AAAAnFBMVEX/3QBjXW2NoG8cXab52g9VfHBbgGsDTqLtHCQRVp1zWSBATXqEajvZwDK9uDSIb0bzzAamlB+MjkwSco+xmj/TzQ2HhWJoqpjQshTjwwguZ4jv0w1yWjJ5jFU0aoSchTe6mgnXthCFeUNPa3Hszwq1tDeEuCHNthSBfoFMZnSAdn6OtHh6hYbI19qtxcyrualnm5ywxxONo490umigh32sAAAAd0lEQVQoz2NgGBJAUoZfRJ6HSwKHNIuKIA+XgjQLLml1USE+UUVc0ryGTOLiTGq8OKQFRPR19YwEBZDF2BGAjVHbwJiJkRVJCEVaU0dYWEMZl7ScqpaYGCOfFA5pZjYhfiVZVmYc0uycnNzcnJzIIgwceMFASgMADGkODcjCRY0AAAAASUVORK5CYII="
flag64["es"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAMAAACtdX32AAAAVFBMVEX/xACzTwzTsbr8wgDUiSvFawfvwy/GCx7uwBrdmDK/rDnztgDZkjPblALJcSSyZgexOhHNsCfNsCjHjmXnvjC9j068d1F4RUKYUB18TVWvSxy6kqEyHguVAAAAVklEQVQoz83RSRLAIAhEUVQgzpp5uv89cwKsuEr+9lU1C2BoBl/y26xtqSNyIoaQiJIx4nKtWov7mMtx64zS5Xjt5+aiwLyoohSzwJPHdUY/Qmf/fegDe6kKdhTlmsEAAAAASUVORK5CYII="
flag64["fk"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAMAAADImI+JAAAA8FBMVEUBIWlgdKHUeY4jdLnYVmvyxs1nbprIEC7AyNoOLHElQH0gPHv6+Pm/x9kTfMfg5O1icJ7f4+xklr////8CWmX88fP21dqlbVO3jnmytsDZ3OfOu7aDsdUfdbuBj5y6vb8cOXmwg24zTISwlooJKG6+zdja2tqftsiigXRroc+81epXgLAggcmanYH13uN2bYIxfL2PaGCRlqwwfL2hYD+VvNgwh8Wpvs5godBvUkWNn7tHV4ijj4tOaZtSlcSLm7Tu7u7O0tUAYY8faXCMrsfAmYNzg5Osp5mysX3JiGJooMevm2aorYO1gWPJw6hikagBkklFAAAA+0lEQVQoz8XQ126DMBSA4UOAGFOTKFA2guyddO+9m3S9/9vUJ8ZSLyJ82f8COJxPQhgMs6UBzyLEwnu9ZpiwLVwgFRCnpgZQQRFWMstxnGQZ+B4hLPBZwkdHbNo7m9olJFvaLOjRyXmDt09V0B0MR6OzU72EFi9hfsAI8fxgmeAsoO4O2T3LJATQWqZRq+PPaE18Kl9TvfFQxMWthILJ4/lDqf74tMuTUC7kgSMVMPPG6ffCyyhU15/M3z8Wn/NJXwFhNvh5e86LmcrBzfrl1Y3yK5Wz02v3a5XHoa2AcRrdTaeXneMDBTzs9HrjizCM9pTfpna3yy/w3/0CuwMWbh/ZsdkAAAAASUVORK5CYII="
flag64["fr"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUAgMAAADnxWVXAAAACVBMVEUAI5XtKTn///+i/AH+AAAAFElEQVQI12NgYOBatSo0NIBh6DAATSAu4Xxi9HsAAAAASUVORK5CYII="
flag64["frs"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAQCAMAAAAhxq8pAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAA8UExURf8AAP8HB/9aWv8GBv8ICP8hIf8YGP8yMv84OP9BQf9CQv8fH/8MDP9lZf8pKf8iIv9FRf8CAv8BAQAAAMJjVhgAAAAUdFJOU/////////////////////////8AT0/nEQAAAAlwSFlzAAAK8AAACvABQqw0mAAAAGFJREFUKFNtjkkSwCAIBMm+r/P/v4ZBSksjIg2NBwWVUEnfKIQZiJZd52seI6fe5BCl5ehdJqe/lHmpSKwKpf+gkHzGOcrQedWy7XGdpMjhXZLAaSjkZbhzqfcBXgo3RQAfnmEQfMJBNFUAAAAASUVORK5CYII="
flag64["gb"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAMAAADImI+JAAAAPFBMVEX////xw8p8jbLnv8pBWY8OLHHw8vfIEC4BIWnWTGKAkLRAWI5LYZXgeIn10tigrMfheYrx2+Htz9hKYJTy9LpmAAAAqUlEQVQoz8XTQRaDIAwFwC8SLBYE9f53LRVCCbJw1yx8koyiMcJOgFH04tBYUkDXBKnZLkldh4Z2kBnAJ2alO6SVqwrtgiSk9iaQ19EPktwL/RYuQ9c/Et45znB467dUyHAvq3AWgHtccJx+Ev+Ej19G53DBAFu0cc/wu/I2HsEVwA1PhSl1eK4NrxluuGTtJ5QUksmhaCkk68dM1SokGwxuoR0b/Qp5zw/L/xHkHUeiPgAAAABJRU5ErkJggg=="
flag64["ie"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUBAMAAAANaGKIAAAAD1BMVEX/iD4Wm2L///+y3sv/176zaFdvAAAAF0lEQVQY02MQBANhJTBwYICAUcHBJAgAHJ0eZQMU55UAAAAASUVORK5CYII=";
flag64["it"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUAgMAAADnxWVXAAAACVBMVEUAkkbOKzf///85rJ3UAAAAFElEQVQI12NgYOBatSo0NIBh6DAATSAu4Xxi9HsAAAAASUVORK5CYII="
flag64["jm"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUBAMAAAANaGKIAAAAIVBMVEX/uBwAd0kAAACHYQ6XnS4SDQEZfkT1sBrxrRoef0PWmhdnQ13iAAAAbklEQVQY023RwQ2AMAgF0H+z8eYK7OAKTTx3BQdwBIdwYKEFUhp6fEnD5wPgOsL7ALyLshW0qGInSLSa3WIEmnWYILVHlW1j62hqNnCom2JXN8OuZgH3BbPv2aAs0hy+aHi3ac2skGBWXVpydo4fbqwzeoyE38IAAAAASUVORK5CYII="
flag64["jp"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUBAMAAABohZD3AAAAElBMVEW8AC3////NP2Dmn7DADzn77/GuzSpGAAAAP0lEQVQY02MQRAUM5PGNXJSR+UEMDAyqSHwFIJ8JwRdmAAFDOF8IzFeE80XAfEecfHT16Oah24fhHnT3ku9/AB+iE2XMgOg6AAAAAElFTkSuQmCC"
flag64["lu"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAUBAMAAADxfUlCAAAAD1BMVEXtKTkAod7///9VwenzcHusVZA/AAAAIUlEQVQY02NgoCNwQQMODEpoQIGGIsZowIBBEA0I0E4EAL4AHCFvjbcyAAAAAElFTkSuQmCC"
flag64["ma"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUBAMAAABohZD3AAAAFVBMVEXBJy1iQi5MSS+nLi2SNC2rLi15PC6Ld+IEAAAAKElEQVQY02NgGBjggsoNFjRF4TspqaDw2ZQSUPiMggIofGYGg4HxBwB4BQJD/6PdEAAAAABJRU5ErkJggg=="
flag64["mc"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAUAQMAAABCuQT+AAAABlBMVEXOESb///9W4q7JAAAAEklEQVQI12NgIBn8//+/gSQCAHAUIuOMnBoSAAAAAElFTkSuQmCC"
flag64["mu"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUAgMAAADnxWVXAAAADFBMVEUApVEaIG3qKDn/1QBAdqXLAAAAHUlEQVQI12NYBQELGIhhhEJAAFGM/xDwgSgGKQAAdktPG8262+oAAAAASUVORK5CYII="
flag64["nl"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUBAMAAABohZD3AAAAD1BMVEUhRotrhLKuHCjIZm7///9fvUPgAAAAHElEQVQY02NUYkABTAzU5bMI4udT2z5GNPNpDQBo2wB0uX4S5QAAAABJRU5ErkJggg=="
flag64["pt"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAMAAACtdX32AAAAn1BMVEX/AADzVwDqkQBTkQAAYQD7PT2yweAAZgD4AADjfACQtADCzQD8LS3xaS/ujhzraA/ipQDsmwCbugDdvwCpvwD2WA/qjlLKmVKEqACjuQDT2ADNorbO1+vk4QBKhwDgoifYuADspFr5Vj6MkiCHnRw1fQDwblvtLwDXngDvfSPsQjPNrVu9nKr8Ryj6u7utiFv5czicrteesNe8n6H7u7sxBDfVAAAAhElEQVQoz2NgRwIMmIBe0iwceKSZuSQ1mBhxSTNr64uLqSkyYpcWkeLj4eXV1VTgxCotKcVqIsOmx6rOhE2ahVuCT4fN0JiPU5gDuzSrNJuRNCt2aXYuVS0DGTZeJUFBrHYLcSuL8vCIystidxq7nJCKuBi/AD/uYBERwB0shAKV/vENAM1rDK2atilmAAAAAElFTkSuQmCC"
flag64["re"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUAgMAAADnxWVXAAAACVBMVEUAI5XtKTn///+i/AH+AAAAFElEQVQI12NgYOBatSo0NIBh6DAATSAu4Xxi9HsAAAAASUVORK5CYII="
flag64["ro"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUAgMAAADnxWVXAAAACVBMVEUAK3/OESb80RYeTc2tAAAAFElEQVQI12NgYOBatSo0NIBh6DAATSAu4Xxi9HsAAAAASUVORK5CYII="
flag64["rs"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAMAAACtdX32AAAAtFBMVEX////FO0HQZzTltLZykLAXQnbScTnGNjwMQHbANj7p19jjzMzTjY7jwsP47O3bl5XalCXUhCjuxMZtSWbVekOXgJSPd4vPW1rXe1LJUlbannTevsDFeDjVd2Pi0tPcnqHOo6Xq4+PIfoLQm53UqavGenzQbFzepmrcjDrJR0399fbFXTLMTjSJSknVn1WBZHzlyLbYgIO6WDrSfTTXpYzs29vera/x5OTIdnnPgobRh2vTgXFvR69fAAAAo0lEQVQoz73O1w6CQBBA0S24wi5LE6Qj1d57+f//MhGNIbg8ep4muZnJgH4n8B1hZ56tfHF2A7JeTMai7BHbJFNbeNw0TMNYtrJSg3sSHSIIlSYgv/R2caBuER7ITZ98OfvZyNWGgsxoXlRh4ggyT3KuplS0zdmNjgq6EWTMKnwtT63XpJp6V8v0qDtSE3iLySNjCGngt7mn8xBZQMjSsQb+6gluZBOQL+4JdQAAAABJRU5ErkJggg=="
flag64["us"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAUCAMAAADWUb86AAAANlBMVEXGWWZ5eJtdQ25tbJI8O25IR3dUU4DZkZqyIjT///+VlbCFhKRgX4mrU2fY1+KaJj+5fpCqqcBFmxQnAAAAh0lEQVQoz8XPSwrDMAxFUau6T0ks9bf/zXYQKBTs4kGhZ6CR0LUbQhAEBOK+DzVchSpK4VI8tqEGqSiZwmXidgw1GaZIWajLaxql406PMnUxjRomEg91PGZRSMLo5+DaxmSk9CRLHfPZGhhR72tff0qS5wNn1y6fZmvHkvZbi9FtSduX/CX6Asb+ET4hHaT8AAAAAElFTkSuQmCC"
flag64["uy"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAMAAACtdX32AAAAVFBMVEX///+7iRX07ePOql0dTrGqvOL8+/o5ZLsAOKiOpti0ghru5dfCkyPTs3D69/Xo3MvGnUvZqgzhy5fQnwtPdcPiza7cwILizKPWuInhsBCbsd20xOU60XNuAAAAcklEQVQYGaXBWRLCIBBAwTdAJoRlsrl7/3vqP0qqtJtjqlmVb9x8qd4cnMYGYD6JLFkJsQHmi+ySNuUxNcDVtN5XqZmP9JrKXsrNeA4N0LMvSRZTQmwAzvm6zRnG0OBNLavxk9BF7GLo4sDURexi7OIvL5HoCsLqMEQ5AAAAAElFTkSuQmCC"
flag64["za"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAMAAACtdX32AAAAb1BMVEUAd0kJe0/sqRn8txv///9AT6fobWUAAAAAFIngPDH07vKneBFQOQiMwq0SDQLd7ecvg0CAlzE1k27UrSOqsdg+mHX1wL3qd29OXK0SJZHW6eLiSkA5hj7ariKPmy/0u7eHmTAzhD+Xx7TjTEKYyLXXNRCBAAAAj0lEQVQoz32RWRLCIBAFHwQliVGDxn1f7n9GgSzFIEP/dr0upgAA8Vb7T5UEnt26PqR1671YqsclpQuTC6CR2xcfgF4timcf2Jz/AtBaN/J2nQJzgtMucB8DiuB1EIjpdRBgtDS8tue1bNyWDf+0aWoP62YEkGl9LCkg01MZ6+BL4qnTmanTmemgxTc9tfwA2zUQndqOrtoAAAAASUVORK5CYII="

flag64["bb"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAUCAMAAACtdX32AAAAPFBMVEX/xyabeBYzJweRcRX+xiWzjBoeFwQAJn9xWBBAMgloUA9aRgzwuyPksiHOoB7Vph94XhHerCC+lBvyvCQmVMjVAAAAYElEQVQoz82RSw7AIAhEUYGCn/rp/e/anWkace0s5yUwDHBNwdTHOwf3buJyA8QIcJclRh+y1xw8roeTgggoGbuRH5HMaEVLQ2REM3lQZnUmrpQS1c3drW1rce7Yj/3xC6MlDMxrrZFjAAAAAElFTkSuQmCC"
flag64["mx"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACMAAAAUCAMAAAAweHR+AAAAb1BMVEX////X07jb3cSUb1HeX23c383r6tYAaEfOESZVmoR3SSjm5M7Iwq7i2tCdx7yrx8DMtZ6Qqo+0n5R0Vj7PyKLLqnd+Y0r39++wtYzl27He0Mp0nJ/049JkOiKAVDqii4Brq62ahV6ziGBekH+8mHOqo5LtAAAAYklEQVQoz93RNxaAIBBFUYIYEAQkmLP7X6N2NJ6x59W3mH8GFbEKxbIyhhIwnTxX/WMGT/kygiZ3t+WcQqaenQ+h3RhgiDK6tVRiwDDW7JeZMIHuedGhiIB31Vj0eYI//TIPmiIRZ/iengEAAAAASUVORK5CYII="

flag64["noflag"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAANCAMAAACTkM4rAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAEXUExURQAAAJKSktXV1lNTUzs7O4mJibW1tVJSUtPT04iIiVVWVnd3eJqamr6+vuvr6/b29nJzc01NTygnJ8nHx+jo6PDw8Ovr7MrJyCMiIrGwsHx9fVFRUaioqJ2dnU9PT4aGhrOzsyMjIg4ODnd3dyoqKh8fH3h4eG5ubx0dHTMzM4B/fg8PDwQEBHRzc2xtbWlpaY6OjouLjGtra3V1dXd2djAwMKmop9LR0YyMjIyLi9PS0qOjozExMQUFBRkZGYeHiKCgoaKiooqLjH5+fmFhYp+goL2+vnBxcKOjore3tri4t2lqa7i5uZCQkWZmZhISEmlpare3uGpqapGRknx+fy0tLggICCMjJCQkJQkJCSwtLX+AgRsbGxD+1OUAAAAJcEhZcwAADr8AAA6/ATgFUyQAAACfSURBVBhXdcjXAoEAGEDhX5JVIdl7r+w9ighZZe/3fw4u/kvO3fngdwbCSJooykSaLVYkm51mWIeDZWin6z8B52Z5j4f3+jgEAH8gGApHorF4AgEgmUpnsrl8oVhCABDKlWqt3mi2BIRv7U631x8MR7gAojSeyAwjT2eSiKTMF0t1tVY327mCtCM0fX84HHWNOCFJ5wtcb/cHPF9vAPgAEyIU6qDlHbIAAAAASUVORK5CYII="
flag64["shield"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAANCAMAAACTkM4rAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABCUExURQoKCv///w8PDwMDAw4ODgICAhAQEC8vL6urqwYGBqqqqoGBgTExMQwMDBgYGM7OzhsbGxoaGh0dHT4+Pj09PQAAACOG5mEAAAAWdFJOU////////////////////////////wAB0sDkAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAAZklEQVQYV2XNCQ6AIAwEwILgUREV7f+/alkheGxIoMMGSIRe0VmXeaRSKWga4d527kvO/8j6vtJgaARN7S1GjXpHMxcKqOHDsIAkao3XLBx1zCQb55IxvOcJJOlQ5DNhuEl3DQ4iF8c1B7jj7jM0AAAAAElFTkSuQmCC"
flag64["unlicenced"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAANCAMAAACTkM4rAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABCUExURQoKCv///w8PDwMDAw4ODgICAhAQEC8vL6urqwYGBqqqqoGBgTExMQwMDBgYGM7OzhsbGxoaGh0dHT4+Pj09PQAAACOG5mEAAAAWdFJOU////////////////////////////wAB0sDkAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAAZklEQVQYV2XNCQ6AIAwEwILgUREV7f+/alkheGxIoMMGSIRe0VmXeaRSKWga4d527kvO/8j6vtJgaARN7S1GjXpHMxcKqOHDsIAkao3XLBx1zCQb55IxvOcJJOlQ5DNhuEl3DQ4iF8c1B7jj7jM0AAAAAElFTkSuQmCC"

flag64["nabilla.png"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAYAAAD/Rn+7AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAJVSURBVEhLY2SgHPyH0uiAGmZTZMh/eR42hmMVCQwc4rJQIQQwKu1iePjhM4hJkUPJ0lxopfW/0E6PgVtZGyqCGwin1oIosh3JBKVJAUQ7DgTezm4GUbiSAUFAqgP/P6qIwHAcyHZQSIEwNpdQ4kiSgr7F1eh/nLEa2IHps1YwrDl9FSz+68YpBlYWFgj7928Gdk1zMDvMTIdhemo4mD1n3wmG8uVbSY5qUjSAQ8900jqGl99+Mfy/cw4qjB8wqhgxSPJxMVzprSQrPZIUxR/0nCGOO7UXKkIYgDzy/NM3hmc8klAR0gDRDlxQX8agq6LEsGdKN1QEEjq4ALLc3kUzGHSUFRlmVRVBRYgHRDsw3tsdTLOyQtIaCDAxIbSDHITsKGQ5mJ7UAG8wTQogKQ2CopbRzBkSxUKCUGHCAORwmF4QFyxIJCApDT5YOwvKIh28Pn8EyiINkOLAJ8yMjAz3ysIZ/v77x8Dw8RNUGBJCxsF5DO7p7SjRDAJ///5leDmjkYEZEuV3wIIkAFIcKCvXsYKBhYmRgcXCFWQzVBgCBPiFGcREpaA8BGBRN2VgYWaCFTGqYEESAElRDATg2gBUHoLT4tt3YEFs4P///+DQhNYiIEByIQ0CpDqQCRSKMPCybztGlIIASOz1wsNQHrzBQBYgy1dA8P9vfB0Dk6YCmMNYkcTgYOPLICklz7B81RSG/x3zwOIgAJIDUWAOGYDUEMQKQA46cGQzhuOoAajiQFoCYoN+MTMTY8zWNdkMwPICKkQ68A6cDCyi/i8CMuMhIoQAAwMAyvqlzhVee30AAAAASUVORK5CYII="

function getCountryFlag(countryCode) {
    if (flag64[countryCode.toLowerCase()] != null)
        return flag64[countryCode.toLowerCase()]

    var code = countryCode.toUpperCase()

    for (let i = 0; i < mcc.length; i++) {
        if (mcc[i].code == code) {
            return "https://flagcdn.com/h20/" + code + ".png"
        }
    }

    return flag64["shield"];
}

function getTgFlag(id) {
    if (id.length > 2 && parseInt(id) > 100) {
        id = id.substring(0, 3)

        switch (id) {
            case "736":
            case "994":
                return flag64["unlicenced"] // return "unlicenced.png"

            case "206":
                return flag64["be"] // return "be.png"

            case "214":
                return flag64["es"] // return "es.png"

            case "228":
                return flag64["ch"] // return "ch.png"

            case "262":
            case "264":
                return flag64["de"] // return "de.png"

            case "102":
            case "302":
                return flag64["ca"] // return "ca.png"

            case "604":
                return flag64["ma"] // return "ma.png"

            case "340":
            case "546":
            case "547":
            case "742":
            case "647":
            case "208":
                return flag64["fr"] // return "fr.png"
/*
            // if you want to return several flags i.e (region / country)
            case 2623:
                return [ flag64["flag1"], flag64["flag2"]  ]
*/
            default:
                break
        }

        for (let i = 0; i < mcc.length; i++) {
            if (mcc[i].dmrid == id) {
                var code = mcc[i].code.toLowerCase()

                if (flag64[code] != null)
                    return flag64[code]
                
                return "https://flagcdn.com/h20/" + code + ".png"
            }
        }
    }

    return flag64["shield"] // "shield.png"
}

function getFlag(callsign, dmrid) {
    // console.log("'"+callsign + "' '" + dmrid+"'")

    if (dmrid.length > 2 && parseInt(dmrid) > 100) {
        // check if beacon has specific bitmap
        for (var key in tgbeacons) {
            if (dmrid == key) {
                if (flag64[tgbeacons[key]] != null)
                    return flag64[tgbeacons[key]]

                return tgbeacons[key]
            }
        }

        dmrid = dmrid.substring(0, 3)

        if (callsign.startsWith("FS"))
            return flag64["shield"] // return "shield.png"

        if (callsign.startsWith("14FRS") || callsign.startsWith("FRS"))
            return flag64["frs"] // return "frs.png"

        if (callsign.startsWith("BALISE") || dmrid.startsWith("14"))
            return flag64["unlicenced"] // return "unlicenced.png"

        switch (dmrid) {
            case "736":
                if (dmrid.indexOf(callsign) != -1) 
                    break // else fall through
            case "994":
                return flag64["unlicenced"] // return "unlicenced.png"

            case "206":
                return flag64["be"] // return "be.png"
            case "214":
                return flag64["es"] // return "es.png"
            case "228":
                return flag64["ch"] // 
            case "262":
            case "264":
                return flag64["de"] // return "de.png"

            case "102":
            case "302":
                return flag64["ca"] // return "ca.png"

            case "604":
                return flag64["ma"] // return "ma.png"

            case "340":
            case "546":
            case "547":
            case "742":
            case "647":
            case "208":
                return flag64["fr"] // return "fr.png"

            default:
                break
        }

        for (let i = 0; i < mcc.length; i++) {
            if (mcc[i].dmrid == dmrid) {
                var code = mcc[i].code.toLowerCase()
                
                if (flag64[code] != null)
                    return flag64[code]

                return "https://flagcdn.com/h20/" + code + ".png"
            }
        }
    }

    return flag64["noflag"] // noflag.png"
}

mcc = [
{
	"dmrid": "653",
	"country": "Eswatini",
	"code": "SZ"
},
{
	"dmrid": "225",
    "country": "Vatican City",
    "code": "VA"
},
{
	"dmrid": "425",
    "country": "Palestinian Authority",
    "code": "PS"
},
{
	"dmrid": "255",
    "country": "Ukraine",
    "code": "UA"
},
{
    "dmrid": "111",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "326",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "113",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "202",
    "country": "Greece",
    "code": "GR"
},
{
    "dmrid": "204",
    "country": "Netherlands",
    "code": "NL"
},
{
    "dmrid": "206",
    "country": "Belgium",
    "code": "BE"
},
{
    "dmrid": "208",
    "country": "France",
    "code": "FR"
},
{
    "dmrid": "212",
    "country": "Monaco",
    "code": "MC"
},
{
    "dmrid": "213",
    "country": "Andorra",
    "code": "AD"
},
{
    "dmrid": "214",
    "country": "Spain",
    "code": "ES"
},
{
    "dmrid": "216",
    "country": "Hungary",
    "code": "HU"
},
{
    "dmrid": "218",
    "country": "Bosnia and Herzegovina",
    "code": "BA"
},
{
    "dmrid": "219",
    "country": "Croatia",
    "code": "HR"
},
{
    "dmrid": "220",
    "country": "Serbia",
    "code": "RS"
},
{
    "dmrid": "221",
    "country": "Kosovo",
    "code": "XK"
},
{
    "dmrid": "222",
    "country": "Italy",
    "code": "IT"
},
{
    "dmrid": "226",
    "country": "Romania",
    "code": "RO"
},
{
    "dmrid": "228",
    "country": "Switzerland",
    "code": "CH"
},
{
    "dmrid": "230",
    "country": "Czech Republic",
    "code": "CZ"
},
{
    "dmrid": "231",
    "country": "Slovakia",
    "code": "SK"
},
{
    "dmrid": "232",
    "country": "Austria",
    "code": "AT"
},
{
    "dmrid": "234",
    "country": "United Kingdom",
    "code": "GB"
},
{
    "dmrid": "235",
    "country": "United Kingdom",
    "code": "GB"
},
{
    "dmrid": "300",
    "country": "United Kingdom",
    "code": "GB"
},
{
    "dmrid": "238",
    "country": "Denmark",
    "code": "DK"
},
{
    "dmrid": "240",
    "country": "Sweden",
    "code": "SE"
},
{
    "dmrid": "242",
    "country": "Norway",
    "code": "NO"
},
{
    "dmrid": "244",
    "country": "Finland",
    "code": "FI"
},
{
    "dmrid": "246",
    "country": "Lithuania",
    "code": "LT"
},
{
    "dmrid": "247",
    "country": "Latvia",
    "code": "LV"
},
{
    "dmrid": "248",
    "country": "Estonia",
    "code": "EE"
},
{
    "dmrid": "250",
    "country": "Russian Federation",
    "code": "RU"
},
{
    "dmrid": "257",
    "country": "Belarus",
    "code": "BY"
},
{
    "dmrid": "259",
    "country": "Moldova",
    "code": "MD"
},
{
    "dmrid": "260",
    "country": "Poland",
    "code": "PL"
},
{
    "dmrid": "262",
    "country": "Germany",
    "code": "DE"
},
{
    "dmrid": "263",
    "country": "Germany",
    "code": "DE"
},
{
    "dmrid": "266",
    "country": "Gibraltar",
    "code": "GI"
},
{
    "dmrid": "268",
    "country": "Portugal",
    "code": "PT"
},
{
    "dmrid": "270",
    "country": "Luxembourg",
    "code": "LU"
},
{
    "dmrid": "272",
    "country": "Republic of Ireland",
    "code": "IE"
},
{
    "dmrid": "274",
    "country": "Iceland",
    "code": "IS"
},
{
    "dmrid": "276",
    "country": "Albania",
    "code": "AL"
},
{
    "dmrid": "278",
    "country": "Malta",
    "code": "MT"
},
{
    "dmrid": "280",
    "country": "Cyprus",
    "code": "CY"
},
{
    "dmrid": "282",
    "country": "Georgia",
    "code": "GE"
},
{
    "dmrid": "283",
    "country": "Armenia",
    "code": "AM"
},
{
    "dmrid": "284",
    "country": "Bulgaria",
    "code": "BG"
},
{
    "dmrid": "286",
    "country": "Turkey",
    "code": "TR"
},
{
    "dmrid": "288",
    "country": "Faroe Islands",
    "code": "FO"
},
{
    "dmrid": "289",
    "country": "Abkhazia",
    "code": "AB"
},
{
    "dmrid": "290",
    "country": "Greenland",
    "code": "GL"
},
{
    "dmrid": "292",
    "country": "San Marino",
    "code": "SM"
},
{
    "dmrid": "293",
    "country": "Slovenia",
    "code": "SI"
},
{
    "dmrid": "294",
    "country": "Republic of North Macedonia",
    "code": "MK"
},
{
    "dmrid": "295",
    "country": "Liechtenstein",
    "code": "LI"
},
{
    "dmrid": "297",
    "country": "Montenegro",
    "code": "ME"
},
{
    "dmrid": "302",
    "country": "Canada",
    "code": "CA"
},
{
    "dmrid": "308",
    "country": "Saint Pierre and Miquelon",
    "code": "PM"
},
{
    "dmrid": "310",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "311",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "312",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "313",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "314",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "315",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "316",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "317",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "318",
    "country": "United States of America",
    "code": "US"
},
{
    "dmrid": "330",
    "country": "Puerto Rico",
    "code": "PR"
},
{
    "dmrid": "334",
    "country": "Mexico",
    "code": "MX"
},
{
    "dmrid": "338",
    "country": "Jamaica",
    "code": "JM"
},
{
    "dmrid": "340",
    "country": "French Antilles",
    "code": "BL"
},
{
    "dmrid": "342",
    "country": "Barbados",
    "code": "BB"
},
{
    "dmrid": "344",
    "country": "Antigua and Barbuda",
    "code": "AG"
},
{
    "dmrid": "346",
    "country": "Cayman Islands",
    "code": "KY"
},
{
    "dmrid": "348",
    "country": "British Virgin Islands",
    "code": "VG"
},
{
    "dmrid": "350",
    "country": "Bermuda",
    "code": "BM"
},
{
    "dmrid": "352",
    "country": "Grenada",
    "code": "GD"
},
{
    "dmrid": "354",
    "country": "Montserrat",
    "code": "MS"
},
{
    "dmrid": "356",
    "country": "Saint Kitts and Nevis",
    "code": "KN"
},
{
    "dmrid": "358",
    "country": "Saint Lucia",
    "code": "LC"
},
{
    "dmrid": "360",
    "country": "Saint Vincent and the Grenadines",
    "code": "VC"
},
{
    "dmrid": "362",
    "country": "Former Netherlands Antilles",
    "code": "BQ"
},
{
    "dmrid": "363",
    "country": "Aruba",
    "code": "AW"
},
{
    "dmrid": "364",
    "country": "Bahamas",
    "code": "BS"
},
{
    "dmrid": "365",
    "country": "Anguilla",
    "code": "AI"
},
{
    "dmrid": "366",
    "country": "Dominica",
    "code": "DM"
},
{
    "dmrid": "368",
    "country": "Cuba",
    "code": "CU"
},
{
    "dmrid": "370",
    "country": "Dominican Republic",
    "code": "DO"
},
{
    "dmrid": "372",
    "country": "Haiti",
    "code": "HT"
},
{
    "dmrid": "374",
    "country": "Trinidad and Tobago",
    "code": "TT"
},
{
    "dmrid": "376",
    "country": "Turks and Caicos Islands",
    "code": "TC"
},
{
    "dmrid": "400",
    "country": "Azerbaijan",
    "code": "AZ"
},
{
    "dmrid": "401",
    "country": "Kazakhstan",
    "code": "KZ"
},
{
    "dmrid": "402",
    "country": "Bhutan",
    "code": "BT"
},
{
    "dmrid": "404",
    "country": "India",
    "code": "IN"
},
{
    "dmrid": "405",
    "country": "India",
    "code": "IN"
},
{
    "dmrid": "410",
    "country": "Pakistan",
    "code": "PK"
},
{
    "dmrid": "412",
    "country": "Afghanistan",
    "code": "AF"
},
{
    "dmrid": "413",
    "country": "Sri Lanka",
    "code": "LK"
},
{
    "dmrid": "414",
    "country": "Myanmar",
    "code": "MM"
},
{
    "dmrid": "415",
    "country": "Lebanon",
    "code": "LB"
},
{
    "dmrid": "416",
    "country": "Jordan",
    "code": "JO"
},
{
    "dmrid": "417",
    "country": "Syria",
    "code": "SY"
},
{
    "dmrid": "418",
    "country": "Iraq",
    "code": "IQ"
},
{
    "dmrid": "419",
    "country": "Kuwait",
    "code": "KW"
},
{
    "dmrid": "420",
    "country": "Saudi Arabia",
    "code": "SA"
},
{
    "dmrid": "421",
    "country": "Yemen",
    "code": "YE"
},
{
    "dmrid": "422",
    "country": "Oman",
    "code": "OM"
},
{
    "dmrid": "424",
    "country": "United Arab Emirates",
    "code": "AE"
},
{
    "dmrid": "425",
    "country": "Israel",
    "code": "IL"
},
{
    "dmrid": "426",
    "country": "Bahrain",
    "code": "BH"
},
{
    "dmrid": "427",
    "country": "Qatar",
    "code": "QA"
},
{
    "dmrid": "428",
    "country": "Mongolia",
    "code": "MN"
},
{
    "dmrid": "429",
    "country": "Nepal",
    "code": "NP"
},
{
    "dmrid": "432",
    "country": "Iran",
    "code": "IR"
},
{
    "dmrid": "434",
    "country": "Uzbekistan",
    "code": "UZ"
},
{
    "dmrid": "436",
    "country": "Tajikistan",
    "code": "TJ"
},
{
    "dmrid": "437",
    "country": "Kyrgyzstan",
    "code": "KG"
},
{
    "dmrid": "438",
    "country": "Turkmenistan",
    "code": "TM"
},
{
    "dmrid": "440",
    "country": "Japan",
    "code": "JP"
},
{
    "dmrid": "441",
    "country": "Japan",
    "code": "JP"
},
{
    "dmrid": "450",
    "country": "South Korea",
    "code": "KR"
},
{
    "dmrid": "452",
    "country": "Vietnam",
    "code": "VN"
},
{
    "dmrid": "454",
    "country": "Hong Kong",
    "code": "HK"
},
{
    "dmrid": "455",
    "country": "Macao",
    "code": "MO"
},
{
    "dmrid": "456",
    "country": "Cambodia",
    "code": "KH"
},
{
    "dmrid": "457",
    "country": "Laos",
    "code": "LA"
},
{
    "dmrid": "460",
    "country": "China",
    "code": "CN"
},
{
    "dmrid": "466",
    "country": "Taiwan",
    "code": "TW"
},
{
    "dmrid": "467",
    "country": "North Korea",
    "code": "KP"
},
{
    "dmrid": "470",
    "country": "Bangladesh",
    "code": "BD"
},
{
    "dmrid": "472",
    "country": "Maldives",
    "code": "MV"
},
{
    "dmrid": "502",
    "country": "Malaysia",
    "code": "MY"
},
{
    "dmrid": "505",
    "country": "Australia",
    "code": "AU"
},
{
    "dmrid": "510",
    "country": "Indonesia",
    "code": "ID"
},
{
    "dmrid": "514",
    "country": "East Timor",
    "code": "TL"
},
{
    "dmrid": "515",
    "country": "Philippines",
    "code": "PH"
},
{
    "dmrid": "520",
    "country": "Thailand",
    "code": "TH"
},
{
    "dmrid": "525",
    "country": "Singapore",
    "code": "SG"
},
{
    "dmrid": "528",
    "country": "Brunei",
    "code": "BN"
},
{
    "dmrid": "530",
    "country": "New Zealand",
    "code": "NZ"
},
{
    "dmrid": "536",
    "country": "Nauru",
    "code": "NR"
},
{
    "dmrid": "537",
    "country": "Papua New Guinea",
    "code": "PG"
},
{
    "dmrid": "539",
    "country": "Tonga",
    "code": "TO"
},
{
    "dmrid": "540",
    "country": "Solomon Islands",
    "code": "SB"
},
{
    "dmrid": "541",
    "country": "Vanuatu",
    "code": "VU"
},
{
    "dmrid": "542",
    "country": "Fiji",
    "code": "FJ"
},
{
    "dmrid": "543",
    "country": "Wallis and Futuna",
    "code": "WF"
},
{
    "dmrid": "544",
    "country": "American Samoa",
    "code": "AS"
},
{
    "dmrid": "545",
    "country": "Kiribati",
    "code": "KI"
},
{
    "dmrid": "546",
    "country": "New Caledonia",
    "code": "NC"
},
{
    "dmrid": "547",
    "country": "French Polynesia",
    "code": "PF"
},
{
    "dmrid": "548",
    "country": "Cook Islands",
    "code": "CK"
},
{
    "dmrid": "549",
    "country": "Samoa",
    "code": "WS"
},
{
    "dmrid": "550",
    "country": "Federated States of Micronesia",
    "code": "FM"
},
{
    "dmrid": "551",
    "country": "Marshall Islands",
    "code": "MH"
},
{
    "dmrid": "552",
    "country": "Palau",
    "code": "PW"
},
{
    "dmrid": "553",
    "country": "Tuvalu",
    "code": "TV"
},
{
    "dmrid": "554",
    "country": "Tokelau",
    "code": "TK"
},
{
    "dmrid": "555",
    "country": "Niue",
    "code": "NU"
},
{
    "dmrid": "602",
    "country": "Egypt",
    "code": "EG"
},
{
    "dmrid": "603",
    "country": "Algeria",
    "code": "DZ"
},
{
    "dmrid": "604",
    "country": "Morocco",
    "code": "MA"
},
{
    "dmrid": "605",
    "country": "Tunisia",
    "code": "TN"
},
{
    "dmrid": "606",
    "country": "Libya",
    "code": "LY"
},
{
    "dmrid": "607",
    "country": "Gambia",
    "code": "GM"
},
{
    "dmrid": "608",
    "country": "Senegal",
    "code": "SN"
},
{
    "dmrid": "609",
    "country": "Mauritania",
    "code": "MR"
},
{
    "dmrid": "610",
    "country": "Mali",
    "code": "ML"
},
{
    "dmrid": "611",
    "country": "Guinea",
    "code": "GN"
},
{
    "dmrid": "612",
    "country": "Ivory Coast",
    "code": "CI"
},
{
    "dmrid": "613",
    "country": "Burkina Faso",
    "code": "BF"
},
{
    "dmrid": "614",
    "country": "Niger",
    "code": "NE"
},
{
    "dmrid": "615",
    "country": "Togo",
    "code": "TG"
},
{
    "dmrid": "616",
    "country": "Benin",
    "code": "BJ"
},
{
    "dmrid": "617",
    "country": "Mauritius",
    "code": "MU"
},
{
    "dmrid": "618",
    "country": "Liberia",
    "code": "LR"
},
{
    "dmrid": "619",
    "country": "Sierra Leone",
    "code": "SL"
},
{
    "dmrid": "620",
    "country": "Ghana",
    "code": "GH"
},
{
    "dmrid": "621",
    "country": "Nigeria",
    "code": "NG"
},
{
    "dmrid": "622",
    "country": "Chad",
    "code": "TD"
},
{
    "dmrid": "623",
    "country": "Central African Republic",
    "code": "CF"
},
{
    "dmrid": "624",
    "country": "Cameroon",
    "code": "CM"
},
{
    "dmrid": "625",
    "country": "Cape Verde",
    "code": "CV"
},
{
    "dmrid": "626",
    "country": "São Tomé and Príncipe",
    "code": "ST"
},
{
    "dmrid": "627",
    "country": "Equatorial Guinea",
    "code": "GQ"
},
{
    "dmrid": "628",
    "country": "Gabon",
    "code": "GA"
},
{
    "dmrid": "629",
    "country": "Republic of the Congo",
    "code": "CG"
},
{
    "dmrid": "630",
    "country": "Democratic Republic of the Congo",
    "code": "CD"
},
{
    "dmrid": "631",
    "country": "Angola",
    "code": "AO"
},
{
    "dmrid": "632",
    "country": "Guinea-Bissau",
    "code": "GW"
},
{
    "dmrid": "633",
    "country": "Seychelles",
    "code": "SC"
},
{
    "dmrid": "634",
    "country": "Sudan",
    "code": "SD"
},
{
    "dmrid": "635",
    "country": "Rwanda",
    "code": "RW"
},
{
    "dmrid": "636",
    "country": "Ethiopia",
    "code": "ET"
},
{
    "dmrid": "637",
    "country": "Somalia",
    "code": "SO"
},
{
    "dmrid": "638",
    "country": "Djibouti",
    "code": "DJ"
},
{
    "dmrid": "639",
    "country": "Kenya",
    "code": "KE"
},
{
    "dmrid": "640",
    "country": "Tanzania",
    "code": "TZ"
},
{
    "dmrid": "641",
    "country": "Uganda",
    "code": "UG"
},
{
    "dmrid": "642",
    "country": "Burundi",
    "code": "BI"
},
{
    "dmrid": "643",
    "country": "Mozambique",
    "code": "MZ"
},
{
    "dmrid": "645",
    "country": "Zambia",
    "code": "ZM"
},
{
    "dmrid": "646",
    "country": "Madagascar",
    "code": "MG"
},
{
    "dmrid": "647",
    "country": "French Departments and Territories in the Indian Ocean",
    "code": "RE"
},
{
    "dmrid": "648",
    "country": "Zimbabwe",
    "code": "ZW"
},
{
    "dmrid": "649",
    "country": "Namibia",
    "code": "NA"
},
{
    "dmrid": "650",
    "country": "Malawi",
    "code": "MW"
},
{
    "dmrid": "651",
    "country": "Lesotho",
    "code": "LS"
},
{
    "dmrid": "652",
    "country": "Botswana",
    "code": "BW"
},
{
    "dmrid": "653",
    "country": "Swaziland",
    "code": "SZ"
},
{
    "dmrid": "654",
    "country": "Comoros",
    "code": "KM"
},
{
    "dmrid": "655",
    "country": "South Africa",
    "code": "ZA"
},
{
    "dmrid": "657",
    "country": "Eritrea",
    "code": "ER"
},
{
    "dmrid": "658",
    "country": "Saint Helena, Ascension and Tristan da Cunha",
    "code": "SH"
},
{
    "dmrid": "659",
    "country": "South Sudan",
    "code": "SS"
},
{
    "dmrid": "702",
    "country": "Belize",
    "code": "BZ"
},
{
    "dmrid": "704",
    "country": "Guatemala",
    "code": "GT"
},
{
    "dmrid": "706",
    "country": "El Salvador",
    "code": "SV"
},
{
    "dmrid": "708",
    "country": "Honduras",
    "code": "HN"
},
{
    "dmrid": "710",
    "country": "Nicaragua",
    "code": "NI"
},
{
    "dmrid": "712",
    "country": "Costa Rica",
    "code": "CR"
},
{
    "dmrid": "714",
    "country": "Panama",
    "code": "PA"
},
{
    "dmrid": "716",
    "country": "Peru",
    "code": "PE"
},
{
    "dmrid": "722",
    "country": "Argentina",
    "code": "AR"
},
{
    "dmrid": "724",
    "country": "Brazil",
    "code": "BR"
},
{
    "dmrid": "730",
    "country": "Chile",
    "code": "CL"
},
{
    "dmrid": "732",
    "country": "Colombia",
    "code": "CO"
},
{
    "dmrid": "734",
    "country": "Venezuela",
    "code": "VE"
},
{
    "dmrid": "736",
    "country": "Bolivia",
    "code": "BO"
},
{
    "dmrid": "738",
    "country": "Guyana",
    "code": "GY"
},
{
    "dmrid": "740",
    "country": "Ecuador",
    "code": "EC"
},
{
    "dmrid": "742",
    "country": "French Guiana",
    "code": "GF"
},
{
    "dmrid": "744",
    "country": "Paraguay",
    "code": "PY"
},
{
    "dmrid": "746",
    "country": "Suriname",
    "code": "SR"
},
{
    "dmrid": "748",
    "country": "Uruguay",
    "code": "UY"
},
{
    "dmrid": "750",
    "country": "Falkland Islands",
    "code": "FK"
}
]

