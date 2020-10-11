import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { AngularFireModule } from '@angular/fire';
import { AngularFireDatabaseModule } from '@angular/fire/database';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { JoinRoomComponent } from './rooms/join-room/join-room.component';
import { WinComponent } from './board/win/win.component';
import { environment } from '../environments/environment';
import { AuthserviceService } from './services/authservices.service';
import { AuthGuardService } from './services/auth-gaurd.service';
import { AllComponent } from './board/all/all.component';
import { FormsModule } from '@angular/forms';
// import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { TokenInterceptor } from './services/auth.interceptor';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { MemoryJoinRoomComponent } from './memory-rooms/memory-join-room/memory-join-room.component';
// import { BrowserAnimationsModule } from '@angular/platform-browser/animations';



@NgModule({
  declarations: [AppComponent, JoinRoomComponent, WinComponent, AllComponent, MemoryJoinRoomComponent ],
  entryComponents: [],
  imports: [
    // BrowserAnimationsModule,
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireDatabaseModule,
    FormsModule,
    HttpClientModule,
    // BrowserAnimationsModule
    // memoryCards,
   ],

  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass : TokenInterceptor,
      multi : true
    },
    StatusBar,
    SplashScreen,
    AuthserviceService,
    HttpClientModule,
    AuthGuardService,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
    // { provide: LocationStrategy, useClass: HashLocationStrategy}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}